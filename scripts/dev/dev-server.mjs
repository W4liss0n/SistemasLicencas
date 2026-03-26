import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..', '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = new Set(process.argv.slice(2));

if (args.has('--help')) {
  printHelp();
  process.exit(0);
}

if (args.has('--api-only') && args.has('--admin-only')) {
  fail('Use apenas uma entre --api-only e --admin-only.');
}

const authPreset = args.has('--auth');
const includeApi = !args.has('--admin-only');
const includeAdmin = !args.has('--api-only') && !authPreset;
const includeInfra = authPreset || args.has('--with-infra');
const includeMockOidc = authPreset || args.has('--with-mock-oidc');
const runMigrations = authPreset || args.has('--migrate');
const runSeed = authPreset || args.has('--seed');

const runtimeProcesses = [];
let isShuttingDown = false;
let forcedExitCode = 0;

process.on('SIGINT', () => {
  forcedExitCode = 0;
  void shutdown();
});

process.on('SIGTERM', () => {
  forcedExitCode = 0;
  void shutdown();
});

try {
  await main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

async function main() {
  const enabledTargets = [];

  if (includeInfra) {
    enabledTargets.push('postgres', 'redis');
  }
  if (includeMockOidc) {
    enabledTargets.push('mock-oidc');
  }
  if (includeApi) {
    enabledTargets.push('api');
  }
  if (includeAdmin) {
    enabledTargets.push('admin-web');
  }

  if (enabledTargets.length === 0) {
    throw new Error('Nenhum processo foi selecionado.');
  }

  log('dev', `workspace: ${workspaceRoot}`);
  log('dev', `iniciando: ${enabledTargets.join(', ')}`);

  if (includeInfra) {
    await runStep('infra', 'docker', ['compose', 'up', '-d', 'postgres', 'redis']);
  }

  if (runMigrations) {
    await runStep('migrate', npmCommand, ['run', 'api:prisma:migrate:deploy']);
  }

  if (runSeed) {
    await runStep('seed', npmCommand, ['run', 'api:prisma:seed']);
  }

  const runtimes = [];

  if (includeMockOidc) {
    runtimes.push({
      name: 'mock-oidc',
      command: 'node',
      args: ['scripts/dev/mock-oidc-provider.mjs'],
    });
  }

  if (includeApi) {
    runtimes.push({
      name: 'api',
      command: npmCommand,
      args: ['run', 'api:dev'],
    });
  }

  if (includeAdmin) {
    runtimes.push({
      name: 'admin-web',
      command: npmCommand,
      args: ['run', 'admin-web:dev'],
    });
  }

  log('dev', 'pressione Ctrl+C para encerrar.');

  for (const runtime of runtimes) {
    startRuntime(runtime);
  }

  await new Promise(() => {});
}

function printHelp() {
  process.stdout.write(
    [
      'Uso:',
      '  npm run dev',
      '  npm run dev:auth',
      '  npm run dev -- --api-only --with-infra --migrate --seed',
      '',
      'Flags:',
      '  --api-only        sobe somente a API',
      '  --admin-only      sobe somente o admin-web',
      '  --with-infra      sobe postgres e redis via docker compose',
      '  --with-mock-oidc  sobe o provider mock OIDC',
      '  --migrate         aplica prisma migrate deploy antes do boot',
      '  --seed            executa prisma seed antes do boot',
      '  --auth            preset para infra + migrate + seed + mock-oidc + api',
      '  --help            mostra esta ajuda',
      '',
    ].join('\n'),
  );
}

async function runStep(name, command, commandArgs) {
  log(name, `${command} ${commandArgs.join(' ')}`);

  const child = spawn(command, commandArgs, {
    cwd: workspaceRoot,
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  pipeLines(child.stdout, (line) => log(name, line));
  pipeLines(child.stderr, (line) => log(name, line, true));

  const result = await waitForExit(child);
  if (result.code !== 0) {
    throw new Error(`${name} terminou com codigo ${result.code ?? 'desconhecido'}.`);
  }
}

function startRuntime(runtime) {
  log(runtime.name, `${runtime.command} ${runtime.args.join(' ')}`);

  const child = spawn(runtime.command, runtime.args, {
    cwd: workspaceRoot,
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  runtimeProcesses.push({ name: runtime.name, child });

  pipeLines(child.stdout, (line) => log(runtime.name, line));
  pipeLines(child.stderr, (line) => log(runtime.name, line, true));

  child.on('close', (code, signal) => {
    if (isShuttingDown) {
      return;
    }

    if (signal) {
      log(runtime.name, `encerrado por sinal ${signal}.`, true);
    } else {
      log(runtime.name, `encerrado com codigo ${code ?? 'desconhecido'}.`, code !== 0);
    }

    forcedExitCode = code ?? 1;
    void shutdown();
  });

  child.on('error', (error) => {
    if (isShuttingDown) {
      return;
    }

    log(runtime.name, `falha ao iniciar: ${error.message}`, true);
    forcedExitCode = 1;
    void shutdown();
  });
}

function pipeLines(stream, onLine) {
  if (!stream) {
    return;
  }

  const lineReader = readline.createInterface({ input: stream });
  lineReader.on('line', onLine);
}

async function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('close', (code, signal) => resolve({ code, signal }));
    child.on('error', reject);
  });
}

async function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  log('dev', 'encerrando processos...');

  await Promise.all(runtimeProcesses.map(({ child }) => stopProcessTree(child)));
  process.exit(forcedExitCode);
}

async function stopProcessTree(child) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
      });

      killer.on('close', () => resolve());
      killer.on('error', () => resolve());
    });

    return;
  }

  child.kill('SIGTERM');

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
      resolve();
    }, 500);

    child.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function log(scope, message, useStderr = false) {
  const target = useStderr ? process.stderr : process.stdout;
  target.write(`[${scope}] ${message}\n`);
}

function fail(message) {
  log('dev', message, true);
  process.exit(1);
}
