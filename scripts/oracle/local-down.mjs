import { downOracle } from './workflow.mjs';

downOracle().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
