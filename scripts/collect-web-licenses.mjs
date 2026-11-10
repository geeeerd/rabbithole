import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '../frontend');
const lock = JSON.parse(readFileSync(join(frontend, 'package-lock.json'), 'utf8'));
const notices = ['RabbitHole web runtime dependency notices', 'The following notices are copied from the installed dependency distributions.', ''];

for (const [location, metadata] of Object.entries(lock.packages)) {
  if (!location || metadata.dev || metadata.optional) continue;
  const directory = join(frontend, location);
  const files = readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^(licen[cs]e|notice)(\.|$)/i.test(entry.name))
    .map(entry => entry.name).sort();
  if (!files.length) throw new Error(`No license notice found for ${location}`);
  notices.push(`${location.replace(/^node_modules\//, '')} ${metadata.version} (${metadata.license ?? 'see notice'})`);
  for (const filename of files) notices.push('', readFileSync(join(directory, filename), 'utf8').trimEnd());
  notices.push('', '----------------------------------------------------------------------------', '');
}

const directory = join(frontend, 'public', 'licenses');
const file = join(directory, 'THIRD_PARTY_NOTICES.txt');
const text = notices.join('\n');
if (process.argv.includes('--refresh')) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(file, text);
} else if (readFileSync(file, 'utf8') !== text) {
  throw new Error('Browser dependency notices changed. Run node scripts/collect-web-licenses.mjs --refresh.');
}
