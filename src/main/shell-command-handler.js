import { app, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import util from 'node:util';

const execPromise = util.promisify(exec);

export async function installShellCommand() {
    const isPackaged = app.isPackaged;
    // Common target path for both macOS and Linux
    const targetPath = '/usr/local/bin/ash';

    // Windows not supported via this method
    if (process.platform === 'win32') {
        return dialog.showMessageBox({
            type: 'info',
            title: 'Not Supported',
            message: 'Automatic shell command installation is currently only supported on macOS and Linux. On Windows, please add the installation directory to your PATH.'
        });
    }

    // Determine source application path
    let appPath;
    if (process.platform === 'darwin') {
        if (isPackaged) {
            // In production: .../ash.app/Contents/MacOS/ash -> .../ash.app
            appPath = path.resolve(process.execPath, '../../..');
        } else {
            // Dev mode fallback
            appPath = '/Applications/ash.app';
        }
    } else if (process.platform === 'linux') {
        // For Linux, we prefer the AppImage file if available
        if (process.env.APPIMAGE) {
            appPath = process.env.APPIMAGE;
        } else {
            // Otherwise use the executable path (e.g. /opt/ash/ash or /usr/bin/ash)
            appPath = process.execPath;
        }
    }

    // Validation
    if (process.platform === 'darwin' && !appPath.endsWith('.app') && isPackaged) {
        console.error('Unexpected app path:', appPath);
    }

    // Script content (macOS only)
    // Linux uses symlink, so this string is only used for macOS
    const scriptContent = `#!/usr/bin/env bash
function realpath() { python -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$1"; }
CONTENTS="$@"
ELECTRON_RUN_AS_NODE=1
export ELECTRON_RUN_AS_NODE
if [ -z "$CONTENTS" ]; then
    open -a "${appPath}"
else
    open -a "${appPath}" --args "$@"
fi
`;

    try {
        // 1. Try to clean up existing file/link
        await fs.promises.unlink(targetPath).catch(() => { });

        // 2. Install based on platform
        if (process.platform === 'linux') {
            // Linux: Create direct symlink
            await fs.promises.symlink(appPath, targetPath);
        } else {
            // macOS: Write wrapper script
            await fs.promises.writeFile(targetPath, scriptContent, { mode: 0o755 });
        }

        // 3. Success
        await dialog.showMessageBox({
            type: 'info',
            title: 'Success',
            message: 'The \'ash\' command has been successfully installed in PATH.'
        });

    } catch (error) {
        console.error('Failed to write directly:', error);

        // If permission denied, try to escalate privileges
        if (error.code === 'EACCES' || error.message.includes('permission')) {
            try {
                if (process.platform === 'darwin') {
                    // macOS: Use osascript with administrator privileges
                    const escapedScript = scriptContent.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, '\\n');
                    const command = `do shell script "echo \\"${escapedScript}\\" > ${targetPath} && chmod 755 ${targetPath}" with administrator privileges`;

                    await execPromise(`osascript -e '${command}'`);
                } else if (process.platform === 'linux') {
                    // Linux: Use pkexec to create symlink
                    // "pkexec ln -sf <source> <target>"
                    const command = `pkexec ln -sf "${appPath}" "${targetPath}"`;
                    await execPromise(command);
                }

                await dialog.showMessageBox({
                    type: 'info',
                    title: 'Success',
                    message: 'The \'ash\' command has been successfully installed in PATH.'
                });
            } catch (sudoError) {
                await dialog.showMessageBox({
                    type: 'error',
                    title: 'Installation Failed',
                    message: `Failed to install command: ${sudoError.message}\n\nYou can manually create a link:\nsudo ln -sf "${appPath}" "${targetPath}"`
                });
            }
        } else {
            await dialog.showMessageBox({
                type: 'error',
                title: 'Installation Failed',
                message: `Failed to install command: ${error.message}`
            });
        }
    }
}
