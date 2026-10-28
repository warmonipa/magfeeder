import { readFile, mkdir, writeFile } from 'node:fs/promises';
const outputs = [['mag-sim-data','MAG_SIM'], ['mag-evolution','MAG_EVOLUTION']];
await mkdir('src/app/generated', {recursive:true});
for (const [file, name] of outputs) {
  const source = await readFile('assets/js/'+file+'.js','utf8');
  const prefix = 'window.'+name+' = ';
  const start = source.indexOf(prefix);
  if(start < 0) throw new Error('Missing data assignment: '+file);
  const value = JSON.parse(source.slice(start+prefix.length).trim().replace(/;$/, ''));
  await writeFile('src/app/generated/'+file+'.json', JSON.stringify(value));
}
