#!/usr/bin/env node
// Run after all generated dish assets have been installed:
// node scripts/check-sandwich-images.cjs
// Checks asset coverage and decoding, not visual ingredient correctness.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const Module=require('node:module');
const ts=require('typescript');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');

async function catalogue(){
  const filename=path.join(root,'app/lib/sandwichCatalog.ts');
  const source=await fs.readFile(filename,'utf8');
  const compiled=ts.transpileModule(source,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const loaded=new Module(filename,module);
  loaded.filename=filename;
  loaded.paths=Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled,filename);
  return loaded.exports.SANDWICH_RECIPES;
}

async function main(){
  const recipes=await catalogue();
  const failures=[];
  const seenPaths=new Set();
  const seenPixels=new Map();
  let decoded=0;
  for(const recipe of recipes){
    const expected=`/images/approved/sandwich/${recipe.id}.webp`;
    if(!/^[a-z0-9_-]+$/.test(recipe.id)||recipe.image!==expected){
      failures.push(`${recipe.id}: image must reference its own dish asset`);
      continue;
    }
    if(seenPaths.has(recipe.image)) failures.push(`${recipe.id}: duplicate asset path`);
    seenPaths.add(recipe.image);
    const filename=path.join(root,'public',recipe.image);
    try{
      const bytes=await fs.readFile(filename);
      const meta=await sharp(bytes,{failOn:'error'}).metadata();
      if(meta.format!=='webp') failures.push(`${recipe.id}: expected WebP, found ${meta.format}`);
      if(meta.width<640||meta.height<480||meta.width<meta.height) failures.push(`${recipe.id}: image must be landscape and at least 640×480; found ${meta.width}×${meta.height}`);
      if(Math.abs(meta.width/meta.height-4/3)>.01) failures.push(`${recipe.id}: expected 4:3 aspect ratio; found ${meta.width}×${meta.height}`);
      if((meta.pages??1)!==1) failures.push(`${recipe.id}: expected one static image`);
      const {data,info}=await sharp(bytes,{failOn:'error'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const hash=crypto.createHash('sha256').update(`${info.width}:${info.height}:${info.channels}:`).update(data).digest('hex');
      const duplicate=seenPixels.get(hash);
      if(duplicate) failures.push(`${recipe.id}: identical image pixels to ${duplicate}`);
      else seenPixels.set(hash,recipe.id);
      decoded++;
    }catch(error){
      failures.push(`${recipe.id}: ${error.code==='ENOENT'?'missing asset':`cannot read/decode asset (${error.message})`}`);
    }
  }
  if(failures.length){
    console.error(`Sandwich images incomplete: ${decoded}/${recipes.length} assets decoded.`);
    for(const failure of failures) console.error(`- ${failure}`);
    process.exitCode=1;
    return;
  }
  console.log(`Sandwich images complete: ${recipes.length}/${recipes.length} unique recipe assets decode as static 4:3 landscape WebP images (at least 640×480).`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
