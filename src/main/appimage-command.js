import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const COMMAND = 'ash';

/** Point ~/.local/bin/ash at the running AppImage so the command survives a renamed update. */
export function installAppImageCommand(target = process.env.APPIMAGE) {
  if (process.platform !== 'linux' || !target) return;
  let targetPath;
  try {
    targetPath = fs.realpathSync(target);
  } catch {
    return;
  }
  const binDir = path.join(os.homedir(), '.local', 'bin');
  const link = path.join(binDir, COMMAND);
  if (targetPath === link) return;
  try {
    fs.mkdirSync(binDir, { recursive: true });
    let stat;
    try {
      stat = fs.lstatSync(link);
    } catch {
      stat = undefined;
    }
    if (stat?.isSymbolicLink()) {
      const current = path.resolve(path.dirname(link), fs.readlinkSync(link));
      if (current === targetPath) return;
      fs.unlinkSync(link);
    } else if (stat) {
      return;
    }
    fs.symlinkSync(targetPath, link);
  } catch (err) {
    console.warn('Failed to install ash command:', err);
  }
}
