import { execSync } from 'node:child_process';

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function run() {
  try {
    execSync('git rev-parse --show-toplevel', { stdio: 'ignore' });
  } catch {
    console.log('No git repository detected. Skipping legacy isolation check.');
    return;
  }

  const output = execSync('git status --porcelain --untracked-files=all', {
    encoding: 'utf8'
  });

  const changedLegacy = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => normalizePath(line.slice(3)))
    .filter(
      (filePath) =>
        filePath === 'legacy/sistema-licencas' || filePath.startsWith('legacy/sistema-licencas/')
    );

  if (changedLegacy.length > 0) {
    console.error('Legacy isolation violated. Changes detected in read-only legacy path:');
    for (const filePath of changedLegacy) {
      console.error(` - ${filePath}`);
    }
    process.exit(1);
  }

  console.log('Legacy isolation check passed.');
}

run();