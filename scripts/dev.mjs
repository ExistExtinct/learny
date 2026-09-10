import {spawn} from 'node:child_process';
import process from 'node:process';

const npm=process.platform==='win32'?'npm.cmd':'npm';
const spawnOptions={stdio:'inherit',shell:process.platform==='win32'};
const children=[
  spawn(npm,['run','dev','--prefix','server'],spawnOptions),
  spawn(npm,['run','dev','--prefix','client'],spawnOptions)
];
let shuttingDown=false;
const stop=code=>{if(shuttingDown)return;shuttingDown=true;for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(code),200)};
for(const child of children)child.on('exit',code=>{if(!shuttingDown&&code&&code!==0)stop(code)});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>stop(0));
