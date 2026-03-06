import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const docsDir = resolve(rootDir, 'docs');

const allowLegacyReferences = new Set([
  resolve(docsDir, 'rewrite-v2', 'compatibility-matrix.md'),
  resolve(docsDir, 'rewrite-v2', 'compatibility-matrix.generated.md')
]);

const forbiddenPatterns = [
  { pattern: /\/api\/v1\b/gi, reason: 'Legacy API route reference (/api/v1)' },
  { pattern: /\bexpress\b/gi, reason: 'Legacy framework reference (Express)' },
  { pattern: /\bx-api-key\b/gi, reason: 'Legacy API key header reference (X-API-Key)' },
  { pattern: /\bapi key\b/gi, reason: 'Legacy API key auth reference (API key)' }
];

function collectMarkdownFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function formatRelative(path) {
  return path.replace(`${rootDir}\\`, '').replaceAll('\\', '/');
}

const markdownFiles = collectMarkdownFiles(docsDir);
const violations = [];

for (const filePath of markdownFiles) {
  if (allowLegacyReferences.has(filePath)) {
    continue;
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const { pattern, reason } of forbiddenPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        violations.push({
          file: formatRelative(filePath),
          line: index + 1,
          reason,
          excerpt: line.trim()
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error('docs:lint failed. Legacy references found outside compatibility docs:\n');
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} | ${violation.reason} | ${violation.excerpt}`
    );
  }
  process.exit(1);
}

console.log('docs:lint passed');