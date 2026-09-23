const {spawnSync}=require('node:child_process'),path=require('node:path');
for(const file of ['cloud-store.cjs','community.cjs']){
 const result=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
