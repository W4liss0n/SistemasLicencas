import { PrismaClient } from '@prisma/client';

type CleanupOptions = {
  dryRun: boolean;
  batchSize: number;
  maxBatches: number;
};

function parsePositiveInt(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${flagName}: "${value}". Use a positive integer.`);
  }
  return parsed;
}

function parseArgs(argv: string[]): CleanupOptions {
  const options: CleanupOptions = {
    dryRun: false,
    batchSize: 1000,
    maxBatches: 100
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--batch-size') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --batch-size');
      }
      options.batchSize = parsePositiveInt(next, '--batch-size');
      i += 1;
      continue;
    }

    if (arg.startsWith('--batch-size=')) {
      options.batchSize = parsePositiveInt(arg.split('=')[1] ?? '', '--batch-size');
      continue;
    }

    if (arg === '--max-batches') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --max-batches');
      }
      options.maxBatches = parsePositiveInt(next, '--max-batches');
      i += 1;
      continue;
    }

    if (arg.startsWith('--max-batches=')) {
      options.maxBatches = parsePositiveInt(arg.split('=')[1] ?? '', '--max-batches');
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      // eslint-disable-next-line no-console
      console.log(`
Usage: tsx scripts/idempotency-cleanup.ts [options]

Options:
  --dry-run                  Only counts expired keys, does not delete.
  --batch-size <number>      Number of rows to process per batch (default: 1000).
  --max-batches <number>     Safety cap for total batches per run (default: 100).
  --help, -h                 Show this help.
`);
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for idempotency cleanup.');
  }

  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  const startedAt = Date.now();
  const expiresBefore = new Date();

  let totalFound = 0;
  let totalRemoved = 0;
  let batchesExecuted = 0;

  try {
    // eslint-disable-next-line no-console
    console.log(
      `[idempotency-cleanup] start dryRun=${options.dryRun} batchSize=${options.batchSize} maxBatches=${options.maxBatches} expiresBefore=${expiresBefore.toISOString()}`
    );

    while (batchesExecuted < options.maxBatches) {
      const records = await prisma.idempotencyKey.findMany({
        where: { expiresAt: { lt: expiresBefore } },
        orderBy: { expiresAt: 'asc' },
        select: { id: true },
        take: options.batchSize
      });

      if (records.length === 0) {
        break;
      }

      batchesExecuted += 1;
      totalFound += records.length;

      if (options.dryRun) {
        // eslint-disable-next-line no-console
        console.log(
          `[idempotency-cleanup] batch=${batchesExecuted} dry-run found=${records.length}`
        );
        continue;
      }

      const ids = records.map((record) => record.id);
      const deleted = await prisma.idempotencyKey.deleteMany({
        where: { id: { in: ids } }
      });
      totalRemoved += deleted.count;

      // eslint-disable-next-line no-console
      console.log(
        `[idempotency-cleanup] batch=${batchesExecuted} deleted=${deleted.count} requested=${records.length}`
      );
    }

    const durationMs = Date.now() - startedAt;
    const capped = batchesExecuted >= options.maxBatches;
    const cappedMessage = capped ? ' maxBatchesReached=true' : '';

    // eslint-disable-next-line no-console
    console.log(
      `[idempotency-cleanup] done batchesExecuted=${batchesExecuted} totalFound=${totalFound} totalRemoved=${totalRemoved} dryRun=${options.dryRun} durationMs=${durationMs}${cappedMessage}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(`[idempotency-cleanup] failed: ${detail}`);
  process.exit(1);
});
