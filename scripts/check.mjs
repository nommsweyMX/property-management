import {readdir} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
for(const dir of ['public','server','scripts','.'])for(const name of await readdir(dir))if(name.endsWith('.mjs')||name.endsWith('.js')){const r=spawnSync(process.execPath,['--check',`${dir}/${name}`],{stdio:'inherit'});if(r.status)process.exit(r.status);}
