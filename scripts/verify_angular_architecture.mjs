import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const walk=p=>readdirSync(p).flatMap(n=>statSync(p+'/'+n).isDirectory()?walk(p+'/'+n):[p+'/'+n]);
const angular=JSON.parse(read('angular.json'));
assert.equal(angular.projects.magfeeder.architect.build.options.outputMode,'static');
for(const p of ['assets/js/mag-sim-ui.js','assets/js/page-chrome.js','index.html'])assert.equal(existsSync(p),false,'retired runtime: '+p);
for(const file of walk('src').filter(f=>/\.(ts|html|js)$/.test(f))){
 const text=read(file);
 assert(!/innerHTML|outerHTML|DOMContentLoaded|customElements\.define|window\.MAG_/.test(text),'non-Angular runtime in '+file);
 if(file.endsWith('.html'))assert(!/<script\b|\son[a-z]+\s*=/i.test(text),'inline scripts in '+file);
}
console.log('Angular ownership and static build contract verified.');
