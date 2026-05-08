import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(appRoot, '..', '..');
const baseUrl = 'http://127.0.0.1:4173';
const viteBin = path.join(workspaceRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const playwrightCli = path.join(
  workspaceRoot,
  'node_modules',
  '@playwright',
  'test',
  'cli.js'
);

async function isServerReady() {
  try {
    const response = await fetch(`${baseUrl}/login`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(processRef) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (processRef.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready with code ${processRef.exitCode}`);
    }

    if (await isServerReady()) {
      return;
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

function runChild(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      env,
      stdio: 'inherit',
      windowsHide: true
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${path.basename(command)} exited by signal ${signal}`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}

async function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }

  serverProcess.kill();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      return;
    }
    await delay(100);
  }

  serverProcess.kill('SIGKILL');
}

async function main() {
  let serverProcess = null;
  const serverAlreadyRunning = await isServerReady();

  if (!serverAlreadyRunning) {
    serverProcess = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '4173'], {
      cwd: appRoot,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true
    });
    await waitForServer(serverProcess);
  }

  try {
    const exitCode = await runChild(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
      ...process.env,
      ADMIN_WEB_E2E_EXTERNAL_SERVER: 'true'
    });
    process.exitCode = exitCode;
  } finally {
    await stopServer(serverProcess);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
