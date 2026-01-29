import { ipcMain } from 'electron';
import os from 'os';
import pty from 'node-pty';
import { exec } from 'child_process';
import fs from 'node:fs';

const localPtySessions = new Map(); // connectionId -> ptyProcess

/**
 * Initialize Local PTY handlers
 */
export function initializeLocalHandlers() {
    // Local connection initiation
    // For local terminal, this just prepares the session ID. 
    // The actual process is spawned in start-shell to match the SSH flow.
    ipcMain.handle('local-connect', async (event, connectionInfo) => {
        const { sessionId } = connectionInfo;

        // faster than crypto for local IDs
        const sessionConnectionId = sessionId || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // We don't spawn yet, just return success and the ID
        return {
            success: true,
            sessionConnectionId,
            connectionKey: 'local' // Logical key for grouping local terminals if needed
        };
    });

    // Start Local shell
    ipcMain.handle('local-start-shell', async (event, connectionId, cols = 80, rows = 24) => {
        const sessionConnectionId = connectionId;

        try {
            // Determine shell
            let shell = process.env.SHELL;

            // Validate or determine shell
            if (os.platform() === 'win32') {
                shell = process.env.COMSPEC || 'powershell.exe';
            } else {
                // If SHELL is missing or doesn't exist, calculate default
                if (!shell || !fs.existsSync(shell)) {
                    shell = os.platform() === 'darwin' ? '/bin/zsh' : '/bin/bash';
                    // Verify the fallback exists, else try /bin/sh
                    if (!fs.existsSync(shell)) {
                        shell = '/bin/sh';
                    }
                }
            }

            // Sanitize input: remove potentially surrounding quotes which can break spawn
            if (shell && (shell.startsWith("'") || shell.startsWith('"'))) {
                shell = shell.replace(/['"]/g, '');
            }

            console.log(`[LocalPTY] Architecture: ${process.arch}, Platform: ${process.platform}`);
            console.log(`[LocalPTY] Spawning shell: '${shell}'`);

            // Validate CWD
            let cwd = process.env.HOME;
            if (cwd && (cwd.startsWith("'") || cwd.startsWith('"'))) {
                cwd = cwd.replace(/['"]/g, '');
            }

            if (!cwd || !fs.existsSync(cwd)) {
                console.warn(`[LocalPTY] HOME (${cwd}) invalid, using process.cwd()`);
                cwd = process.cwd();
            }

            console.log(`[LocalPTY] Final CWD: '${cwd}'`);

            // Validate shell (simple check for POSIX)
            if (os.platform() !== 'win32' && !shell.startsWith('/') && shell !== 'bash') {
                console.warn(`[LocalPTY] Warning: Shell path '${shell}' is not absolute. This might fail if not in PATH.`);
            }

            // Prepare environment variables - filter out Electron/VSCode specifics that might confuse zsh
            const ptyEnv = { ...process.env };

            // Remove Electron specific variables
            Object.keys(ptyEnv).forEach(key => {
                if (key.startsWith('ELECTRON_') || key.startsWith('npm_') || key === 'TERM_PROGRAM') {
                    delete ptyEnv[key];
                }
            });

            // Set standard terminal variables
            ptyEnv.TERM = 'xterm-256color';
            ptyEnv.COLORTERM = 'truecolor';
            ptyEnv.LANG = process.env.LANG || 'en_US.UTF-8';
            ptyEnv.LC_CTYPE = process.env.LC_CTYPE || 'UTF-8';

            // Ensure HOME is correct
            ptyEnv.HOME = cwd;
            // Set a custom TERM_PROGRAM so we can identify our shell if needed, 
            // but keeps it distinct from 'Apple_Terminal' or 'vscode'
            ptyEnv.TERM_PROGRAM = 'ash';

            // Sanitize dimensions
            // Force a meaningful minimum size (80x24) for the initial spawn.
            // Spawning a shell in a tiny window (e.g. 31x32 from an unhydrated frontend) 
            // can cause zsh/readline to glitch or disable features permanently.
            // The frontend will send a proper 'resize' event shortly after with the true size.
            let safeCols = parseInt(cols) || 80;
            let safeRows = parseInt(rows) || 24;

            if (safeCols < 80) {
                console.log(`[LocalPTY] Override initial cols ${safeCols} -> 80 to prevent shell glitches`);
                safeCols = 80;
            }
            if (safeRows < 24) {
                console.log(`[LocalPTY] Override initial rows ${safeRows} -> 24 to prevent shell glitches`);
                safeRows = 24;
            }

            console.log(`[LocalPTY] Spawning with cols=${safeCols}, rows=${safeRows}`);

            const ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: safeCols,
                rows: safeRows,
                cwd: cwd,
                env: ptyEnv,
                handleFlowControl: true // Handle flow control automatically
            });

            const webContents = event.sender;

            // Store session
            localPtySessions.set(sessionConnectionId, { process: ptyProcess, webContents });

            // Handle Data
            ptyProcess.onData((data) => {
                try {
                    if (!webContents.isDestroyed()) {
                        webContents.send('local-data', { connectionId: sessionConnectionId, data });
                    }
                } catch (error) {
                    console.warn(`[LocalPTY] Failed to send data: ${error.message}`);
                }
            });

            // Handle Exit
            ptyProcess.onExit(({ exitCode, signal }) => {
                console.log(`[LocalPTY] Process exited: code=${exitCode}, signal=${signal}`);
                try {
                    if (!webContents.isDestroyed()) {
                        webContents.send('local-closed', { connectionId: sessionConnectionId, exitCode });
                    }
                } catch (error) {
                    console.warn(`[LocalPTY] Failed to send closed event: ${error.message}`);
                }
                localPtySessions.delete(sessionConnectionId);
            });

            return { success: true, pid: ptyProcess.pid };
        } catch (error) {
            console.error('[LocalPTY] Failed to spawn:', error);
            throw new Error(`Failed to start local shell: ${error.message}`);
        }
    });

    // Write to PTY
    ipcMain.on('local-write', (event, { connectionId, data }) => {
        const session = localPtySessions.get(connectionId);
        if (session && session.process) {
            try {
                session.process.write(data);
            } catch (error) {
                console.error('[LocalPTY] Write error:', error);
            }
        }
    });

    // Resize PTY
    ipcMain.handle('local-resize', async (event, connectionId, cols, rows) => {
        const session = localPtySessions.get(connectionId);
        if (session && session.process) {
            try {
                // Validate dimensions
                const safeCols = Math.max(1, parseInt(cols) || 80);
                const safeRows = Math.max(1, parseInt(rows) || 24);

                console.log(`[LocalPTY] Resizing session ${connectionId} to ${safeCols}x${safeRows} (requested: ${cols}x${rows})`);

                session.process.resize(safeCols, safeRows);
                return { success: true };
            } catch (error) {
                console.error('[LocalPTY] Resize error:', error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: 'Session not found' };
    });

    // Disconnect (Kill process)
    ipcMain.handle('local-disconnect', async (event, connectionId) => {
        const session = localPtySessions.get(connectionId);
        if (session && session.process) {
            try {
                session.process.kill();
                localPtySessions.delete(connectionId);
                return { success: true };
            } catch (error) {
                console.error('[LocalPTY] Disconnect error:', error);
                return { success: false };
            }
        }
        return { success: true }; // Already gone
    });
}

/**
 * Cleanup all local sessions
 */
export function cleanupLocalConnections() {
    localPtySessions.forEach((session) => {
        if (session.process) {
            try {
                session.process.kill();
            } catch (e) {
                console.error('[LocalPTY] Cleanup error:', e);
            }
        }
    });
    localPtySessions.clear();
}

/**
 * Get map of Local PTY sessions
 */
export function getLocalSessions() {
    return localPtySessions;
}

/**
 * Execute a command on the local machine (associated with a session context)
 */
export async function executeLocalCommand(connectionId, command) {
    const session = localPtySessions.get(connectionId);
    // Note: We don't strictly require session for local exec if we trust the IPC bridge, 
    // but enforcing it ensures we only execute if the user has an active local terminal session "open" (implies intent).
    if (!session) {
        throw new Error(`Local session not found: ${connectionId}`);
    }

    return new Promise((resolve, reject) => {
        exec(command, { cwd: process.env.HOME }, (error, stdout, stderr) => {
            resolve({
                success: !error,
                output: stdout.toString(),
                error: stderr.toString() || (error ? error.message : ''),
                exitCode: error ? error.code : 0
            });
        });
    });
}
