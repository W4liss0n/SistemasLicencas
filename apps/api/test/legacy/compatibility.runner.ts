/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type JsonObject = Record<string, unknown>;

type HttpResult = {
  status: number | null;
  body: JsonObject;
  error: string | null;
};

type Outcome =
  | 'success'
  | 'unauthorized'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'client_error'
  | 'server_error'
  | 'unreachable';

type ScenarioRow = {
  scenario: string;
  legacyStatus: number | null;
  v2Status: number | null;
  legacyCode: string | null;
  v2Code: string | null;
  legacyOutcome: Outcome;
  v2Outcome: Outcome;
  compatible: boolean;
  divergence: 'none' | 'accepted' | 'non_accepted';
  note: string;
};

type ScenarioFailure = {
  message: string;
  accepted: boolean;
};

const legacyBase = process.env.LEGACY_BASE_URL ?? 'http://127.0.0.1:3000';
const v2Base = process.env.V2_BASE_URL ?? 'http://127.0.0.1:3001';

const fixtures = {
  legacyProgramId: process.env.LEGACY_PROGRAM_ID ?? '',
  legacyAuthUsername: process.env.LEGACY_AUTH_USERNAME ?? 'joao@example.com',
  legacyAuthPassword: process.env.LEGACY_AUTH_PASSWORD ?? 'demo123',
  legacyLicenseKey: process.env.LEGACY_LICENSE_KEY ?? 'LIC-TEST-1234-5678-ABCD',
  legacyTransferLimitLicenseKey:
    process.env.LEGACY_TRANSFER_LIMIT_LICENSE_KEY ?? 'LIC-LIMT-0000-0000-0000',
  v2ProgramId: process.env.V2_PROGRAM_ID ?? 'demo-program',
  v2AuthIdentifier: process.env.V2_AUTH_IDENTIFIER ?? 'demo@example.com',
  v2AuthPassword: process.env.V2_AUTH_PASSWORD ?? 'demo123',
  v2LicenseKey: process.env.V2_LICENSE_KEY ?? 'LIC-DEMO-ACTIVE-0001',
  v2TransferLimitLicenseKey: process.env.V2_TRANSFER_LIMIT_LICENSE_KEY ?? 'LIC-LIM-TRN-0004'
};

const unknownLicense = 'LIC-ZZZZ-ZZZZ-ZZZZ-ZZZZ';
const runKeySuffix = Date.now().toString(36);

function scopedIdempotencyKey(seed: string): string {
  return `${seed}-${runKeySuffix}`;
}

const fingerprintA = {
  machine_id: 'MACHINE-A',
  disk_serial: 'DISK-A',
  mac_address: 'AA:BB:CC:DD:EE:01'
};

const fingerprintB = {
  machine_id: 'MACHINE-B',
  disk_serial: 'DISK-B',
  mac_address: 'AA:BB:CC:DD:EE:02'
};

const fingerprintC = {
  machine_id: 'MACHINE-C',
  disk_serial: 'DISK-C',
  mac_address: 'AA:BB:CC:DD:EE:03'
};

function headersForLegacy(): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };

  if (fixtures.legacyProgramId) {
    headers['x-program-id'] = fixtures.legacyProgramId;
  }

  return headers;
}

function headersForV2(extra?: Record<string, string>): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-program-id': fixtures.v2ProgramId,
    ...(extra ?? {})
  };
}

function codeFromBody(body: JsonObject): string | null {
  const code = body.code ?? body.error;
  return typeof code === 'string' ? code : null;
}

function classifyStatusOutcome(status: number | null): Outcome {
  if (status === null) {
    return 'unreachable';
  }
  if (status >= 200 && status < 300) {
    return 'success';
  }
  if (status === 401 || status === 403) {
    return 'unauthorized';
  }
  if (status === 404) {
    return 'not_found';
  }
  if (status === 409) {
    return 'conflict';
  }
  if (status === 429) {
    return 'rate_limited';
  }
  if (status >= 400 && status < 500) {
    return 'client_error';
  }
  if (status >= 500) {
    return 'server_error';
  }
  return 'client_error';
}

function classifyOutcome(result: HttpResult): Outcome {
  if (result.status !== null && result.status >= 200 && result.status < 300) {
    const body = result.body ?? {};
    const explicitFailure = body.success === false || body.valid === false;

    if (!explicitFailure) {
      return 'success';
    }

    const code = codeFromBody(body) ?? '';
    if (code.includes('not_found')) {
      return 'not_found';
    }
    if (code.includes('limit')) {
      return 'rate_limited';
    }
    if (code.includes('conflict')) {
      return 'conflict';
    }
    if (code.includes('unauthorized') || code.includes('invalid_credentials')) {
      return 'unauthorized';
    }
    return 'client_error';
  }

  return classifyStatusOutcome(result.status);
}

async function requestJson(url: string, options: RequestInit): Promise<HttpResult> {
  try {
    const response = await fetch(url, options);
    const body = (await response.json().catch(() => ({}))) as JsonObject;
    return {
      status: response.status,
      body,
      error: null
    };
  } catch (error) {
    return {
      status: null,
      body: {},
      error: String(error)
    };
  }
}

function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function addScenario(
  rows: ScenarioRow[],
  scenario: string,
  legacy: HttpResult,
  v2: HttpResult,
  failure: ScenarioFailure | null,
  note: string
): void {
  const legacyCode = codeFromBody(legacy.body);
  const v2Code = codeFromBody(v2.body);
  const compatible = failure === null;

  rows.push({
    scenario,
    legacyStatus: legacy.status,
    v2Status: v2.status,
    legacyCode,
    v2Code,
    legacyOutcome: classifyOutcome(legacy),
    v2Outcome: classifyOutcome(v2),
    compatible,
    divergence: compatible ? (legacyCode === v2Code && legacy.status === v2.status ? 'none' : 'accepted') : 'non_accepted',
    note: compatible
      ? note
      : `${failure.message}${failure.accepted ? ' (accepted divergence)' : ''}`
  });
}

function evaluateExpectedSuccess(legacy: HttpResult, v2: HttpResult): ScenarioFailure | null {
  const legacySuccess = classifyOutcome(legacy) === 'success';
  const v2Success = classifyOutcome(v2) === 'success';

  if (!legacySuccess || !v2Success) {
    return {
      message: 'Expected success on both runtimes, but one side failed.',
      accepted: false
    };
  }

  return null;
}

function evaluateExpectedFailure(legacy: HttpResult, v2: HttpResult): ScenarioFailure | null {
  const legacySuccess = classifyOutcome(legacy) === 'success';
  const v2Success = classifyOutcome(v2) === 'success';

  if (legacySuccess || v2Success) {
    return {
      message: 'Expected failure on both runtimes, but one side succeeded.',
      accepted: false
    };
  }

  return null;
}

function evaluateTransferLimitFailure(legacy: HttpResult, v2: HttpResult): ScenarioFailure | null {
  const baseFailure = evaluateExpectedFailure(legacy, v2);
  if (baseFailure) {
    return baseFailure;
  }

  if (classifyOutcome(v2) !== 'rate_limited') {
    return {
      message: 'v2 must return rate_limited semantics for transfer limit.',
      accepted: false
    };
  }

  return null;
}

function evaluateReplayBehavior(params: {
  legacyFirst: HttpResult;
  legacySecond: HttpResult;
  v2First: HttpResult;
  v2Second: HttpResult;
}): ScenarioFailure | null {
  if (classifyOutcome(params.v2First) !== 'success') {
    return {
      message: 'v2 first transfer call failed unexpectedly.',
      accepted: false
    };
  }

  if (classifyOutcome(params.v2Second) !== 'success') {
    return {
      message: 'v2 replay call failed unexpectedly.',
      accepted: false
    };
  }

  const normalizeReplayBody = (input: JsonObject): JsonObject => {
    const clone = { ...input };
    delete clone.trace_id;
    return clone;
  };

  const v2SameResponse =
    params.v2First.status === params.v2Second.status &&
    stableStringify(normalizeReplayBody(params.v2First.body)) ===
      stableStringify(normalizeReplayBody(params.v2Second.body));

  if (!v2SameResponse) {
    return {
      message: 'v2 replay did not return the same response for identical idempotency key+payload.',
      accepted: false
    };
  }

  const legacyBothSuccess =
    classifyOutcome(params.legacyFirst) === 'success' &&
    classifyOutcome(params.legacySecond) === 'success';

  if (!legacyBothSuccess) {
    return {
      message: 'legacy transfer replay did not remain semantically successful.',
      accepted: false
    };
  }

  return null;
}

async function run(): Promise<void> {
  const rows: ScenarioRow[] = [];

  if (!fixtures.legacyProgramId) {
    console.warn(
      'LEGACY_PROGRAM_ID is not set. Legacy checks will still run, but program-level parity will be weaker.'
    );
  }

  const legacyHeaders = headersForLegacy();
  const v2Headers = headersForV2();

  const authenticateInvalidLegacy = await requestJson(`${legacyBase}/api/v1/license/authenticate`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      username: 'invalid@example.com',
      password: 'bad-pass',
      device_fingerprint: fingerprintA,
      program_version: '2.0.0',
      os_info: 'Windows'
    })
  });

  const authenticateInvalidV2 = await requestJson(`${v2Base}/api/v2/license/authenticate`, {
    method: 'POST',
    headers: v2Headers,
    body: JSON.stringify({
      identifier: 'invalid@example.com',
      password: 'bad-pass'
    })
  });

  addScenario(
    rows,
    'authenticate_invalid_credentials',
    authenticateInvalidLegacy,
    authenticateInvalidV2,
    evaluateExpectedFailure(authenticateInvalidLegacy, authenticateInvalidV2),
    'Both runtimes reject invalid credentials.'
  );

  const authenticateSuccessLegacy = await requestJson(`${legacyBase}/api/v1/license/authenticate`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      username: fixtures.legacyAuthUsername,
      password: fixtures.legacyAuthPassword,
      device_fingerprint: fingerprintA,
      program_version: '2.0.0',
      os_info: 'Windows'
    })
  });

  const authenticateSuccessV2 = await requestJson(`${v2Base}/api/v2/license/authenticate`, {
    method: 'POST',
    headers: v2Headers,
    body: JSON.stringify({
      identifier: fixtures.v2AuthIdentifier,
      password: fixtures.v2AuthPassword
    })
  });

  addScenario(
    rows,
    'authenticate_success',
    authenticateSuccessLegacy,
    authenticateSuccessV2,
    evaluateExpectedSuccess(authenticateSuccessLegacy, authenticateSuccessV2),
    'Both runtimes authenticate seeded credentials.'
  );

  const validateBadPayloadLegacy = await requestJson(`${legacyBase}/api/v1/license/validate`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: 'BAD-KEY'
    })
  });

  const validateBadPayloadV2 = await requestJson(`${v2Base}/api/v2/licenses/validate`, {
    method: 'POST',
    headers: v2Headers,
    body: JSON.stringify({
      license_key: 'BAD-KEY'
    })
  });

  addScenario(
    rows,
    'validate_bad_payload',
    validateBadPayloadLegacy,
    validateBadPayloadV2,
    evaluateExpectedFailure(validateBadPayloadLegacy, validateBadPayloadV2),
    'Both runtimes reject malformed validate payload.'
  );

  const validateUnknownLegacy = await requestJson(`${legacyBase}/api/v1/license/validate`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: unknownLicense,
      device_fingerprint: fingerprintA,
      program_version: '2.0.0',
      os_info: 'Windows'
    })
  });

  const validateUnknownV2 = await requestJson(`${v2Base}/api/v2/licenses/validate`, {
    method: 'POST',
    headers: v2Headers,
    body: JSON.stringify({
      license_key: unknownLicense,
      device_fingerprint: { raw_components: fingerprintA },
      program_version: '2.0.0',
      os_info: 'Windows'
    })
  });

  addScenario(
    rows,
    'validate_unknown_license',
    validateUnknownLegacy,
    validateUnknownV2,
    evaluateExpectedFailure(validateUnknownLegacy, validateUnknownV2),
    'Both runtimes reject unknown license key.'
  );

  const validateSuccessLegacy = await requestJson(`${legacyBase}/api/v1/license/validate`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: fixtures.legacyLicenseKey,
      device_fingerprint: fingerprintA,
      program_version: '2.0.0',
      os_info: 'Windows'
    })
  });

  const validateSuccessV2 = await requestJson(`${v2Base}/api/v2/licenses/validate`, {
    method: 'POST',
    headers: v2Headers,
    body: JSON.stringify({
      license_key: fixtures.v2LicenseKey,
      device_fingerprint: { raw_components: fingerprintA },
      program_version: '2.0.0',
      os_info: 'Windows'
    })
  });

  addScenario(
    rows,
    'validate_success',
    validateSuccessLegacy,
    validateSuccessV2,
    evaluateExpectedSuccess(validateSuccessLegacy, validateSuccessV2),
    'Both runtimes validate active license.'
  );

  const activateSuccessLegacy = await requestJson(`${legacyBase}/api/v1/license/activate`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: fixtures.legacyLicenseKey,
      device_fingerprint: fingerprintA
    })
  });

  const activateSuccessV2 = await requestJson(`${v2Base}/api/v2/licenses/activate`, {
    method: 'POST',
    headers: headersForV2({
      'idempotency-key': scopedIdempotencyKey('compat-activate-success')
    }),
    body: JSON.stringify({
      license_key: fixtures.v2LicenseKey,
      device_fingerprint: { raw_components: fingerprintA },
      program_version: '2.0.0',
      os_info: 'Windows'
    })
  });

  addScenario(
    rows,
    'activate_success',
    activateSuccessLegacy,
    activateSuccessV2,
    evaluateExpectedSuccess(activateSuccessLegacy, activateSuccessV2),
    'Both runtimes activate license on current device.'
  );

  const heartbeatSuccessLegacy = await requestJson(`${legacyBase}/api/v1/license/heartbeat`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: fixtures.legacyLicenseKey,
      device_fingerprint: fingerprintA,
      program_version: '2.0.0',
      os_info: 'Windows'
    })
  });

  const heartbeatSuccessV2 = await requestJson(`${v2Base}/api/v2/licenses/heartbeat`, {
    method: 'POST',
    headers: v2Headers,
    body: JSON.stringify({
      license_key: fixtures.v2LicenseKey,
      device_fingerprint: { raw_components: fingerprintA },
      program_version: '2.0.0',
      os_info: 'Windows'
    })
  });

  addScenario(
    rows,
    'heartbeat_success',
    heartbeatSuccessLegacy,
    heartbeatSuccessV2,
    evaluateExpectedSuccess(heartbeatSuccessLegacy, heartbeatSuccessV2),
    'Both runtimes heartbeat current device.'
  );

  await requestJson(`${legacyBase}/api/v1/license/deactivate`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: fixtures.legacyLicenseKey,
      device_fingerprint: fingerprintA
    })
  });

  await requestJson(`${v2Base}/api/v2/licenses/deactivate`, {
    method: 'POST',
    headers: headersForV2({
      'idempotency-key': scopedIdempotencyKey('compat-pre-transfer-cleanup')
    }),
    body: JSON.stringify({
      license_key: fixtures.v2LicenseKey,
      device_fingerprint: { raw_components: fingerprintA }
    })
  });

  const transferSuccessLegacy = await requestJson(`${legacyBase}/api/v1/license/transfer`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: fixtures.legacyLicenseKey,
      new_device_fingerprint: fingerprintB
    })
  });

  const transferSuccessV2 = await requestJson(`${v2Base}/api/v2/licenses/transfer`, {
    method: 'POST',
    headers: headersForV2({
      'idempotency-key': scopedIdempotencyKey('compat-transfer-success')
    }),
    body: JSON.stringify({
      license_key: fixtures.v2LicenseKey,
      new_device_fingerprint: { raw_components: fingerprintB },
      reason: 'compatibility_success'
    })
  });

  addScenario(
    rows,
    'transfer_success',
    transferSuccessLegacy,
    transferSuccessV2,
    evaluateExpectedSuccess(transferSuccessLegacy, transferSuccessV2),
    'Both runtimes transfer active license to another device.'
  );

  const transferReplayKey = scopedIdempotencyKey('compat-transfer-replay');

  const transferReplayLegacyFirst = await requestJson(`${legacyBase}/api/v1/license/transfer`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: fixtures.legacyLicenseKey,
      new_device_fingerprint: fingerprintB
    })
  });

  const transferReplayLegacySecond = await requestJson(`${legacyBase}/api/v1/license/transfer`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: fixtures.legacyLicenseKey,
      new_device_fingerprint: fingerprintB
    })
  });

  const transferReplayV2First = await requestJson(`${v2Base}/api/v2/licenses/transfer`, {
    method: 'POST',
    headers: headersForV2({
      'idempotency-key': transferReplayKey
    }),
    body: JSON.stringify({
      license_key: fixtures.v2LicenseKey,
      new_device_fingerprint: { raw_components: fingerprintB },
      reason: 'compatibility_replay'
    })
  });

  const transferReplayV2Second = await requestJson(`${v2Base}/api/v2/licenses/transfer`, {
    method: 'POST',
    headers: headersForV2({
      'idempotency-key': transferReplayKey
    }),
    body: JSON.stringify({
      license_key: fixtures.v2LicenseKey,
      new_device_fingerprint: { raw_components: fingerprintB },
      reason: 'compatibility_replay'
    })
  });

  const replayFailure = evaluateReplayBehavior({
    legacyFirst: transferReplayLegacyFirst,
    legacySecond: transferReplayLegacySecond,
    v2First: transferReplayV2First,
    v2Second: transferReplayV2Second
  });

  addScenario(
    rows,
    'transfer_idempotency_replay',
    transferReplayLegacySecond,
    transferReplayV2Second,
    replayFailure,
    `Replay probe: legacy first=${transferReplayLegacyFirst.status}, legacy second=${transferReplayLegacySecond.status}, v2 first=${transferReplayV2First.status}, v2 second=${transferReplayV2Second.status}.`
  );

  const transferLimitLegacy = await requestJson(`${legacyBase}/api/v1/license/transfer`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: fixtures.legacyTransferLimitLicenseKey,
      new_device_fingerprint: fingerprintC
    })
  });

  const transferLimitV2 = await requestJson(`${v2Base}/api/v2/licenses/transfer`, {
    method: 'POST',
    headers: headersForV2({
      'idempotency-key': scopedIdempotencyKey('compat-transfer-limit')
    }),
    body: JSON.stringify({
      license_key: fixtures.v2TransferLimitLicenseKey,
      new_device_fingerprint: { raw_components: fingerprintC },
      reason: 'compatibility_transfer_limit'
    })
  });

  addScenario(
    rows,
    'transfer_limit_exceeded',
    transferLimitLegacy,
    transferLimitV2,
    evaluateTransferLimitFailure(transferLimitLegacy, transferLimitV2),
    'Both runtimes reject transfer when monthly limit is exceeded.'
  );

  const deactivateSuccessLegacy = await requestJson(`${legacyBase}/api/v1/license/deactivate`, {
    method: 'POST',
    headers: legacyHeaders,
    body: JSON.stringify({
      license_key: fixtures.legacyLicenseKey,
      device_fingerprint: fingerprintB
    })
  });

  const deactivateSuccessV2 = await requestJson(`${v2Base}/api/v2/licenses/deactivate`, {
    method: 'POST',
    headers: headersForV2({
      'idempotency-key': scopedIdempotencyKey('compat-deactivate-success')
    }),
    body: JSON.stringify({
      license_key: fixtures.v2LicenseKey,
      device_fingerprint: { raw_components: fingerprintB }
    })
  });

  addScenario(
    rows,
    'deactivate_success',
    deactivateSuccessLegacy,
    deactivateSuccessV2,
    evaluateExpectedSuccess(deactivateSuccessLegacy, deactivateSuccessV2),
    'Both runtimes deactivate device binding.'
  );

  const v2HeaderGuardProbe = await requestJson(`${v2Base}/api/v2/licenses/activate`, {
    method: 'POST',
    headers: headersForV2(),
    body: JSON.stringify({
      license_key: fixtures.v2LicenseKey,
      device_fingerprint: { raw_components: fingerprintA }
    })
  });

  const headerProbeFailure =
    classifyOutcome(v2HeaderGuardProbe) === 'success'
      ? {
          message: 'v2 accepted mutate endpoint without Idempotency-Key header.',
          accepted: false
        }
      : null;

  addScenario(
    rows,
    'v2_required_header_guard',
    { status: null, body: {}, error: null },
    v2HeaderGuardProbe,
    headerProbeFailure,
    'v2 mutating endpoint must reject missing Idempotency-Key.'
  );

  const nonAcceptedFailures = rows.filter((row) => row.divergence === 'non_accepted');

  const markdown = [
    '# Compatibility Matrix (Generated)',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '## Semantic Gate',
    '',
    '- Accepted divergences:',
    '  - Error payload format and taxonomy differences (`problem+json` vs legacy shape).',
    '  - HTTP status variation within failure class when both sides reject equivalent semantics.',
    '- Non-accepted divergences:',
    '  - Success/error inversion in paired scenarios.',
    '  - Authorization semantic regressions in expected-success flows.',
    '  - Required-header regression in v2 mutating endpoints.',
    '',
    `Summary: ${rows.length} scenarios, ${nonAcceptedFailures.length} non-accepted divergence(s).`,
    '',
    '| Scenario | Legacy Status | v2 Status | Legacy Outcome | v2 Outcome | Legacy Code | v2 Code | Compatible | Divergence | Note |',
    '|---|---:|---:|---|---|---|---|---|---|---|',
    ...rows.map((row) => {
      return `| ${row.scenario} | ${row.legacyStatus ?? 'n/a'} | ${row.v2Status ?? 'n/a'} | ${row.legacyOutcome} | ${row.v2Outcome} | ${row.legacyCode ?? 'n/a'} | ${row.v2Code ?? 'n/a'} | ${row.compatible ? 'yes' : 'no'} | ${row.divergence} | ${row.note} |`;
    })
  ].join('\n');

  const outputDir = join(process.cwd(), '..', '..', 'docs', 'rewrite-v2');
  mkdirSync(outputDir, { recursive: true });
  const outputFile = join(outputDir, 'compatibility-matrix.generated.md');
  writeFileSync(outputFile, markdown);
  console.log(`Compatibility matrix generated at ${outputFile}`);

  if (nonAcceptedFailures.length > 0) {
    console.error('\nNon-accepted compatibility divergences detected:');
    for (const failure of nonAcceptedFailures) {
      console.error(`- ${failure.scenario}: ${failure.note}`);
    }
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
