import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeCmd = process.execPath;

export const paths = {
  v2Dir: resolve(__dirname, '..', '..'),
  workspaceDir: resolve(__dirname, '..', '..', '..'),
  legacyDir: resolve(__dirname, '..', '..', 'legacy', 'sistema-licencas'),
  composeFile: resolve(__dirname, 'docker-compose.oracle.yml'),
  fixturesFile: resolve(__dirname, '..', '..', '.tmp', 'oracle-fixtures.json')
};

export const oracleConfig = {
  legacy: {
    port: 3000,
    dbHost: '127.0.0.1',
    dbPort: 55432,
    dbName: 'oracle_legacy',
    dbUser: 'postgres',
    dbPassword: 'postgres',
    redisHost: '127.0.0.1',
    redisPort: 56379
  },
  v2: {
    port: 3001,
    dbHost: '127.0.0.1',
    dbPort: 55433,
    dbName: 'oracle_v2',
    dbUser: 'postgres',
    dbPassword: 'postgres',
    redisHost: '127.0.0.1',
    redisPort: 56380
  }
};

function prefixStream(stream, prefix, writer) {
  if (!stream) {
    return;
  }

  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (line.length > 0) {
        writer(`[${prefix}] ${line}\n`);
      }
    }
  });
  stream.on('end', () => {
    if (pending.length > 0) {
      writer(`[${prefix}] ${pending}\n`);
    }
  });
}

function resolveSpawnTarget(command, args) {
  if (process.platform !== 'win32') {
    return { command, args };
  }

  const normalized = command.toLowerCase();
  if (normalized.endsWith('.cmd')) {
    const comspec = process.env.ComSpec ?? 'cmd.exe';
    return {
      command: comspec,
      args: ['/d', '/s', '/c', command, ...args]
    };
  }

  return { command, args };
}

export async function runCommand({
  command,
  args,
  cwd,
  env,
  label,
  quiet = false,
  allowFailure = false
}) {
  const mergedEnv = { ...process.env, ...env };
  const normalizedEnv = {};
  for (const [key, value] of Object.entries(mergedEnv)) {
    if (value === undefined || value === null) {
      continue;
    }
    normalizedEnv[key] = String(value);
  }

  return await new Promise((resolvePromise, rejectPromise) => {
    const spawnTarget = resolveSpawnTarget(command, args);
    const child = spawn(spawnTarget.command, spawnTarget.args, {
      cwd,
      env: normalizedEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (!quiet) {
        process.stdout.write(`[${label}] ${text}`);
      }
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (!quiet) {
        process.stderr.write(`[${label}] ${text}`);
      }
    });

    child.once('error', (error) => {
      rejectPromise(error);
    });

    child.once('close', (code) => {
      if (code !== 0 && !allowFailure) {
        const error = new Error(
          `${label} failed with exit code ${code}\n${stderr || stdout || '(no output)'}`
        );
        rejectPromise(error);
        return;
      }

      resolvePromise({
        code: code ?? 0,
        stdout,
        stderr
      });
    });
  });
}

function buildLegacyEnv(overrides = {}) {
  return {
    DB_HOST: oracleConfig.legacy.dbHost,
    DB_PORT: String(oracleConfig.legacy.dbPort),
    DB_NAME: oracleConfig.legacy.dbName,
    DB_USER: oracleConfig.legacy.dbUser,
    DB_PASSWORD: oracleConfig.legacy.dbPassword,
    REDIS_HOST: oracleConfig.legacy.redisHost,
    REDIS_PORT: String(oracleConfig.legacy.redisPort),
    PORT: String(oracleConfig.legacy.port),
    API_VERSION: 'v1',
    NODE_ENV: 'development',
    ...overrides
  };
}

function buildV2Env(overrides = {}) {
  const databaseUrl = `postgresql://${oracleConfig.v2.dbUser}:${oracleConfig.v2.dbPassword}@${oracleConfig.v2.dbHost}:${oracleConfig.v2.dbPort}/${oracleConfig.v2.dbName}`;
  const redisUrl = `redis://${oracleConfig.v2.redisHost}:${oracleConfig.v2.redisPort}`;

  return {
    NODE_ENV: 'development',
    PORT: String(oracleConfig.v2.port),
    API_PREFIX: '/api/v2',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_SECRET: process.env.JWT_SECRET ?? 'oracle-local-jwt-secret-with-32-characters',
    AUTH_PASSWORD_PEPPER:
      process.env.AUTH_PASSWORD_PEPPER ?? 'oracle-local-auth-pepper-with-32-characters',
    REQUEST_TIMEOUT_MS: process.env.REQUEST_TIMEOUT_MS ?? '3000',
    IDEMPOTENCY_TTL_HOURS: process.env.IDEMPOTENCY_TTL_HOURS ?? '24',
    OTEL_ENABLED: process.env.OTEL_ENABLED ?? 'false',
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME ?? 'sistema-licencas-v2',
    METRICS_ENABLED: process.env.METRICS_ENABLED ?? 'false',
    METRICS_PATH: process.env.METRICS_PATH ?? '/metrics',
    ...overrides
  };
}

async function dockerCompose(args, options = {}) {
  return await runCommand({
    command: 'docker',
    args: ['compose', '-f', paths.composeFile, ...args],
    cwd: paths.v2Dir,
    env: options.env,
    label: 'docker-compose',
    quiet: options.quiet ?? false,
    allowFailure: options.allowFailure ?? false
  });
}

async function checkDockerPreflight() {
  try {
    await runCommand({
      command: 'docker',
      args: ['info'],
      cwd: paths.v2Dir,
      label: 'docker-preflight',
      quiet: true
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[oracle] Docker daemon is unavailable.\n` +
        '1. Start Docker Desktop (or your Docker daemon).\n' +
        '2. Validate Docker access with: docker info\n' +
        '3. Re-run: npm run compat:legacy:local\n\n' +
        `Details: ${detail}`
    );
  }
}

async function waitForTcpPort(host, port, timeoutMs, label) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const connected = await new Promise((resolvePromise) => {
      const socket = new net.Socket();
      const onDone = (result) => {
        socket.destroy();
        resolvePromise(result);
      };

      socket.setTimeout(1000);
      socket.once('connect', () => onDone(true));
      socket.once('timeout', () => onDone(false));
      socket.once('error', () => onDone(false));
      socket.connect(port, host);
    });

    if (connected) {
      return;
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }

  throw new Error(`Timed out waiting for ${label} (${host}:${port})`);
}

async function runWithRetries(label, operation, retries = 3, delayMs = 3000) {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (attempt > retries) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[oracle] ${label} failed (attempt ${attempt}/${retries + 1}). Retrying in ${delayMs}ms. ${message}`
      );
      await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
    }
  }
}

async function waitForHttp(url, timeoutMs, label) {
  const start = Date.now();
  let lastError = 'unknown';

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.status < 500) {
        return;
      }
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = String(error);
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }

  throw new Error(`Timed out waiting for ${label} (${url}): ${lastError}`);
}

async function prepareLegacyFixtures() {
  const setupScript = `
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

(async () => {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const activeSubscription = await client.query(
      \`SELECT a.id, a.cliente_id, a.plano_id
       FROM assinaturas a
       WHERE a.status = 'ativa'
       ORDER BY a.created_at ASC
       LIMIT 1\`
    );

    if (activeSubscription.rows.length === 0) {
      throw new Error('No active subscription found after seed');
    }

    const subscription = activeSubscription.rows[0];
    const passwordHash = await bcrypt.hash('demo123', 10);

    await client.query(
      \`UPDATE clientes
       SET senha = $1,
           usuario = COALESCE(usuario, 'demo-client'),
           plano_id = COALESCE(plano_id, $2)
       WHERE id = $3\`,
      [passwordHash, subscription.plano_id, subscription.cliente_id]
    );

    const limitLicenseExisting = await client.query(
      \`SELECT assinatura_id
       FROM licencas
       WHERE license_key = 'LIC-LIMT-0000-0000-0000'
       LIMIT 1\`
    );

    if (limitLicenseExisting.rows.length === 0) {
      const limitSubscriptionResult = await client.query(
        \`INSERT INTO assinaturas (
           cliente_id,
           plano_id,
           data_inicio,
           data_fim,
           auto_renovar,
           status
         )
         VALUES (
           $1,
           $2,
           CURRENT_TIMESTAMP,
           CURRENT_TIMESTAMP + INTERVAL '30 days',
           FALSE,
           'ativa'
         )
         RETURNING id\`,
        [subscription.cliente_id, subscription.plano_id]
      );

      await client.query(
        \`INSERT INTO licencas (assinatura_id, license_key, status, max_offline_hours)
         VALUES ($1, 'LIC-LIMT-0000-0000-0000', 'ativa', 168)\`,
        [limitSubscriptionResult.rows[0].id]
      );
    }

    await client.query(
      \`DELETE FROM license_transfers
       WHERE license_key = 'LIC-LIMT-0000-0000-0000'\`
    );

    await client.query(
      \`INSERT INTO license_transfers (
         license_key,
         old_fingerprint_hash,
         new_fingerprint_hash,
         old_device_info,
         new_device_info,
         reason
       )
       VALUES
         ('LIC-LIMT-0000-0000-0000', NULL, NULL, '{}'::jsonb, '{}'::jsonb, 'user_requested'),
         ('LIC-LIMT-0000-0000-0000', NULL, NULL, '{}'::jsonb, '{}'::jsonb, 'user_requested'),
         ('LIC-LIMT-0000-0000-0000', NULL, NULL, '{}'::jsonb, '{}'::jsonb, 'user_requested')\`
    );

    const programResult = await client.query(
      \`SELECT p.id
       FROM programas p
       ORDER BY p.created_at ASC
       LIMIT 1\`
    );

    const licenseResult = await client.query(
      \`SELECT l.license_key
       FROM licencas l
       WHERE l.license_key <> 'LIC-LIMT-0000-0000-0000'
       ORDER BY l.created_at ASC
       LIMIT 1\`
    );

    if (programResult.rows.length === 0) {
      throw new Error('No program found after seed');
    }

    if (licenseResult.rows.length === 0) {
      throw new Error('No baseline license found after seed');
    }

    await client.query('COMMIT');

    const fixture = {
      legacyProgramId: programResult.rows[0].id,
      legacyAuthUsername: 'joao@example.com',
      legacyAuthPassword: 'demo123',
      legacyLicenseKey: licenseResult.rows[0].license_key,
      legacyTransferLimitLicenseKey: 'LIC-LIMT-0000-0000-0000',
      v2ProgramId: 'demo-program',
      v2AuthIdentifier: 'demo@example.com',
      v2AuthPassword: 'demo123',
      v2LicenseKey: 'LIC-DEMO-ACTIVE-0001',
      v2TransferLimitLicenseKey: 'LIC-LIM-TRN-0004'
    };

    console.log(JSON.stringify(fixture));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
`;

  const result = await runCommand({
    command: nodeCmd,
    args: ['-e', setupScript],
    cwd: paths.legacyDir,
    env: buildLegacyEnv(),
    label: 'legacy-fixture-setup',
    quiet: true
  });

  const fixtureLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .reverse()
    .find((line) => line.startsWith('{') && line.endsWith('}'));

  if (!fixtureLine) {
    throw new Error(`Failed to parse legacy fixture setup output:\n${result.stdout}`);
  }

  return JSON.parse(fixtureLine);
}

export function loadFixtures() {
  if (!existsSync(paths.fixturesFile)) {
    return null;
  }

  return JSON.parse(readFileSync(paths.fixturesFile, 'utf8'));
}

export async function upOracle() {
  console.log('[oracle] running Docker preflight');
  await checkDockerPreflight();

  console.log('[oracle] resetting previous oracle stack');
  await dockerCompose(['down', '-v', '--remove-orphans'], { quiet: true, allowFailure: true });

  console.log('[oracle] starting oracle infrastructure');
  await dockerCompose(['up', '-d']);

  console.log('[oracle] waiting for postgres and redis');
  await waitForTcpPort(oracleConfig.legacy.dbHost, oracleConfig.legacy.dbPort, 60_000, 'legacy postgres');
  await waitForTcpPort(oracleConfig.v2.dbHost, oracleConfig.v2.dbPort, 60_000, 'v2 postgres');
  await waitForTcpPort(
    oracleConfig.legacy.redisHost,
    oracleConfig.legacy.redisPort,
    60_000,
    'legacy redis'
  );
  await waitForTcpPort(oracleConfig.v2.redisHost, oracleConfig.v2.redisPort, 60_000, 'v2 redis');

  console.log('[oracle] running legacy migrations and seed');
  await runWithRetries('legacy migrate', async () => {
    await runCommand({
      command: npmCmd,
      args: ['run', 'migrate'],
      cwd: paths.legacyDir,
      env: buildLegacyEnv(),
      label: 'legacy-migrate'
    });
  });
  await runWithRetries('legacy seed', async () => {
    await runCommand({
      command: npmCmd,
      args: ['run', 'seed'],
      cwd: paths.legacyDir,
      env: buildLegacyEnv(),
      label: 'legacy-seed'
    });
  });

  console.log('[oracle] running v2 migrations and seed');
  await runWithRetries('v2 migrate', async () => {
    await runCommand({
      command: npmCmd,
      args: ['run', 'api:prisma:migrate:deploy'],
      cwd: paths.v2Dir,
      env: buildV2Env(),
      label: 'v2-migrate'
    });
  });
  await runWithRetries('v2 seed', async () => {
    await runCommand({
      command: npmCmd,
      args: ['run', 'api:prisma:seed'],
      cwd: paths.v2Dir,
      env: buildV2Env(),
      label: 'v2-seed'
    });
  });

  console.log('[oracle] preparing compatibility fixtures');
  const fixtures = await prepareLegacyFixtures();
  mkdirSync(dirname(paths.fixturesFile), { recursive: true });
  writeFileSync(paths.fixturesFile, `${JSON.stringify(fixtures, null, 2)}\n`);

  console.log('[oracle] local oracle is ready');
}

function spawnServer({ label, command, args, cwd, env }) {
  const mergedEnv = { ...process.env, ...env };
  const normalizedEnv = {};
  for (const [key, value] of Object.entries(mergedEnv)) {
    if (value === undefined || value === null) {
      continue;
    }
    normalizedEnv[key] = String(value);
  }

  const spawnTarget = resolveSpawnTarget(command, args);
  const child = spawn(spawnTarget.command, spawnTarget.args, {
    cwd,
    env: normalizedEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  prefixStream(child.stdout, label, process.stdout.write.bind(process.stdout));
  prefixStream(child.stderr, label, process.stderr.write.bind(process.stderr));

  return child;
}

async function stopServer(child, label) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    await runCommand({
      command: 'taskkill',
      args: ['/PID', String(child.pid), '/T', '/F'],
      cwd: paths.v2Dir,
      label: `${label}-stop`,
      quiet: true,
      allowFailure: true
    });
    return;
  }

  await new Promise((resolvePromise) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }, 5_000);

    child.once('close', () => {
      clearTimeout(timeout);
      resolvePromise();
    });

    child.kill('SIGTERM');
  });
}

export async function runOracle() {
  const fixtures = loadFixtures();
  if (!fixtures) {
    throw new Error(
      'Oracle fixtures not found. Run "npm run compat:legacy:up" before "npm run compat:legacy:run".'
    );
  }

  const legacyEnv = buildLegacyEnv();
  const v2Env = buildV2Env();

  const legacyServer = spawnServer({
    label: 'legacy-api',
    command: npmCmd,
    args: ['run', 'dev'],
    cwd: paths.legacyDir,
    env: legacyEnv
  });

  const v2Server = spawnServer({
    label: 'v2-api',
    command: npmCmd,
    args: ['run', 'api:dev'],
    cwd: paths.v2Dir,
    env: v2Env
  });

  try {
    console.log('[oracle] waiting for legacy API health');
    await waitForHttp(
      `http://127.0.0.1:${oracleConfig.legacy.port}/health`,
      120_000,
      'legacy api health'
    );

    console.log('[oracle] waiting for v2 API health');
    await waitForHttp(
      `http://127.0.0.1:${oracleConfig.v2.port}/api/v2/health`,
      120_000,
      'v2 api health'
    );

    console.log('[oracle] running compatibility runner');
    await runCommand({
      command: npmCmd,
      args: ['run', 'api:test:legacy'],
      cwd: paths.v2Dir,
      env: {
        ...v2Env,
        LEGACY_BASE_URL: `http://127.0.0.1:${oracleConfig.legacy.port}`,
        V2_BASE_URL: `http://127.0.0.1:${oracleConfig.v2.port}`,
        LEGACY_PROGRAM_ID: fixtures.legacyProgramId,
        LEGACY_AUTH_USERNAME: fixtures.legacyAuthUsername,
        LEGACY_AUTH_PASSWORD: fixtures.legacyAuthPassword,
        LEGACY_LICENSE_KEY: fixtures.legacyLicenseKey,
        LEGACY_TRANSFER_LIMIT_LICENSE_KEY: fixtures.legacyTransferLimitLicenseKey,
        V2_PROGRAM_ID: fixtures.v2ProgramId,
        V2_AUTH_IDENTIFIER: fixtures.v2AuthIdentifier,
        V2_AUTH_PASSWORD: fixtures.v2AuthPassword,
        V2_LICENSE_KEY: fixtures.v2LicenseKey,
        V2_TRANSFER_LIMIT_LICENSE_KEY: fixtures.v2TransferLimitLicenseKey
      },
      label: 'compatibility-runner'
    });

    console.log('[oracle] compatibility runner finished successfully');
  } finally {
    await stopServer(legacyServer, 'legacy-api');
    await stopServer(v2Server, 'v2-api');
  }
}

export async function downOracle() {
  console.log('[oracle] tearing down oracle infrastructure');
  await dockerCompose(['down', '-v', '--remove-orphans'], { allowFailure: true });
  if (existsSync(paths.fixturesFile)) {
    rmSync(paths.fixturesFile);
  }
  console.log('[oracle] cleanup finished');
}
