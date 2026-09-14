import fs from 'node:fs';
const required=['worker.js','schema.sql','wrangler.toml.example','.dev.vars.example','tools/generate-keys.mjs'];
let ok=true;
for(const f of required){if(!fs.existsSync(new URL('../'+f,import.meta.url))){console.error('Manca:',f);ok=false;}}
const worker=fs.readFileSync(new URL('../worker.js',import.meta.url),'utf8');
for(const s of ['/health','/push/subscriptions','/auth/google/code','/auth/google/refresh']){if(!worker.includes(s)){console.error('Endpoint mancante:',s);ok=false;}}
if(!worker.includes("contractVersion:'1'")){console.error('Contract version mancante');ok=false;}
console.log(ok?'Thalys backend package: OK':'Thalys backend package: ERRORE');
process.exit(ok?0:1);
