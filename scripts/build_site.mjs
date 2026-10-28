import { cp, mkdir, rename, rm, readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
if (process.versions.node.split('.')[0] !== '24') throw new Error('Use Node.js 24 (nvm use).');
const output = path.join(root, '_site');
const temporary = path.join(root, '.site-build-'+process.pid);
const backup = path.join(root, '.site-backup-'+process.pid);
execFileSync(process.execPath, ['scripts/generate_data.mjs'], {stdio:'inherit'});
execFileSync(process.execPath, ['node_modules/@angular/cli/bin/ng.js','build'], {stdio:'inherit',env:{...process.env,NG_BUILD_MAX_WORKERS:'1'}});
await mkdir(temporary, {recursive:true});
let backedUp = false;
try {
 await cp('dist/magfeeder/browser', temporary, {recursive:true});
 await rm(path.join(temporary,'index.csr.html'),{force:true});
 for (const file of ['CNAME','.nojekyll']) await cp(file,path.join(temporary,file));
 // Angular renders a real error page; Pages serves it with HTTP 404.
 await cp(path.join(temporary,'404.html/index.html'),path.join(temporary,'error.html'));
 await rm(path.join(temporary,'404.html'),{recursive:true});
 await rename(path.join(temporary,'error.html'),path.join(temporary,'404.html'));
 for (const [file, marker] of [['index.html','当前 Mag'],['planner/index.html','目标 Mag'],['404.html','页面不存在']]) {
  const html=await readFile(path.join(temporary,file),'utf8');
  if(!html.includes(marker)||!html.includes('ngh='))throw new Error('Missing prerendered Angular content: '+file);
 }
 try {await access(output);await rename(output,backup);backedUp=true;}catch(e){if(e.code!=='ENOENT')throw e;}
 await rename(temporary,output);
 if(backedUp) await rm(backup,{recursive:true});
 console.log('Built prerendered simulator, planner and 404 in _site.');
} catch(error) {
 await rm(temporary,{recursive:true,force:true});
 if(backedUp) {try{await access(output);}catch{await rename(backup,output);}}
 throw error;
}
