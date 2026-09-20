import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const paths = ['assets/js/mag-evolution.js', 'assets/js/mag-sim-data.js'];
const [metadataText, ...contents] = await Promise.all([
  readFile('third_party/haven-mag-data/upstream.json', 'utf8'),
  ...paths.map((filename) => readFile(filename, 'utf8')),
]);
const metadata = JSON.parse(metadataText);
const sha256 = (content) => createHash('sha256').update(content).digest('hex');
let failures = 0;

function check(name, condition) {
  if (condition) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.error(`FAIL ${name}`);
  }
}

check('canonical commit is recorded', /^[0-9a-f]{40}$/.test(metadata.observedMasterCommit));
for (const [index, filename] of paths.entries()) {
  const content = contents[index];
  check(`${filename} source URL is pinned to the recorded commit`,
    metadata.sources[filename]?.includes(`/${metadata.observedMasterCommit}/`));
  check(`${filename} source hash is recorded`,
    /^[0-9a-f]{64}$/.test(metadata.sourceSha256[filename] || ''));
  check(`${filename} generated hash matches`,
    sha256(content) === metadata.generatedSha256[filename]);
  check(`${filename} points maintainers to the local sync command`,
    content.includes('Regenerate here: npm run sync:data'));
}

if (failures) process.exitCode = 1;
else console.log('Canonical Mag data provenance passed.');
