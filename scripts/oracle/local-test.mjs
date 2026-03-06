import { downOracle, runOracle, upOracle } from './workflow.mjs';

let exitCode = 0;
let oracleStarted = false;

try {
  await upOracle();
  oracleStarted = true;
  await runOracle();
} catch (error) {
  exitCode = 1;
  // eslint-disable-next-line no-console
  console.error(error);
} finally {
  if (oracleStarted) {
    try {
      await downOracle();
    } catch (cleanupError) {
      exitCode = 1;
      // eslint-disable-next-line no-console
      console.error(cleanupError);
    }
  }
}

process.exit(exitCode);
