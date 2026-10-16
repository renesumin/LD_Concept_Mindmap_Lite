import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Vite copies every file in public/, including files ignored by Git. Fail before
// building if anything other than the reviewed demo would be published.
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const allowed = new Set(['sample-generation.json']);
const entries = await readdir(publicDir, { withFileTypes: true });
const unexpected = entries.filter(entry => !entry.isFile() || !allowed.has(entry.name));
if (unexpected.length) {
  console.error(`Public-file review required: ${unexpected.map(entry => entry.name).join(', ')}`);
  console.error('Nothing was deleted. Review these files before adding them to the public allowlist.');
  process.exitCode = 1;
} else {
  console.log('Public files checked: sample-generation.json (reviewed demo only).');
}
