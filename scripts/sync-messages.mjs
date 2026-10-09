/**
 * Builds public/i18n/<locale>.json from the base catalogues in
 * src/i18n/base/<locale>.json (vendored from the original application so the
 * frontend is self-contained) deep-merged with the overlay
 * src/i18n/<locale>.extra.json plus every feature fragment in src/i18n/<locale>/*.json
 * (keys introduced by the v2 backend and screens, one file per feature area).
 * Runs before `start` and `build`; the output folder is generated, not edited.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'i18n');
mkdirSync(outDir, { recursive: true });

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const merge = (base, extra) => {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) out[key] = isObject(value) && isObject(out[key]) ? merge(out[key], value) : value;
  return out;
};
const read = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});

for (const locale of ['ar', 'en']) {
  let merged = merge(read(join(root, 'src', 'i18n', 'base', `${locale}.json`)), read(join(root, 'src', 'i18n', `${locale}.extra.json`)));
  const fragments = join(root, 'src', 'i18n', locale);
  if (existsSync(fragments)) {
    for (const file of readdirSync(fragments).filter((name) => name.endsWith('.json')).sort()) merged = merge(merged, read(join(fragments, file)));
  }
  writeFileSync(join(outDir, `${locale}.json`), JSON.stringify(merged));
}
console.log('i18n: catalogues synced to public/i18n');
