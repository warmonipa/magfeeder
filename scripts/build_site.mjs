import { cp, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '_site');
const temporary = path.join(root, `.site-build-${process.pid}`);
const rootFiles = ['index.html', '404.html', 'CNAME', '.nojekyll'];

await rm(temporary, { recursive: true, force: true });
await mkdir(temporary, { recursive: true });
try {
  await Promise.all(rootFiles.map((file) => cp(
    path.join(root, file),
    path.join(temporary, file),
  )));
  await cp(path.join(root, 'assets'), path.join(temporary, 'assets'), { recursive: true });
  await rm(output, { recursive: true, force: true });
  await rename(temporary, output);
  console.log('Built verified Mag Feeder artifact in _site.');
} catch (error) {
  await rm(temporary, { recursive: true, force: true });
  throw error;
}
