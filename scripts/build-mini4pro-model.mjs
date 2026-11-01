import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const output=path.resolve('artifacts/aircraft-model-mini4pro-v01');
const require=createRequire(import.meta.url);
const validator=require(path.join(output,'tools/node_modules/gltf-validator'));
const browser=await chromium.launch({headless:true});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1.5});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:17839/?build=1');
 await page.waitForFunction(()=>window.modelReady||window.modelError,{},{timeout:90000});
 const error=await page.evaluate(()=>window.modelError);if(error)throw Error(error);
 const data=await page.evaluate(()=>window.exportGLB());
 const bytes=Buffer.from(data,'base64');await fs.writeFile(path.join(output,'mini-4-pro.glb'),bytes);
 const validation=await validator.validateBytes(new Uint8Array(bytes),{uri:'mini-4-pro.glb'});
 await fs.writeFile(path.join(output,'gltf-validation.json'),JSON.stringify(validation,null,2));
 if(validation.issues.numErrors)throw Error('GLB validation errors: '+JSON.stringify(validation.issues));
 await page.goto('http://127.0.0.1:17839/');
 await page.waitForFunction(()=>window.modelReady||window.modelError,{},{timeout:90000});
 if(await page.evaluate(()=>window.modelError))throw Error(await page.evaluate(()=>window.modelError));
 await fs.mkdir(path.join(output,'preview'),{recursive:true});
 for(const view of ['hero','front','side','top','bottom','detail']) {
  await page.evaluate(v=>window.setView(v),view);
  await page.waitForTimeout(500);
  await page.screenshot({path:path.join(output,'preview',view+'.png')});
 }
 const stats=await page.evaluate(()=>{
  let meshes=0,triangles=0,vertices=0;const names=[];
  window.assetRoot.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}if(/^Rotor_(FL|FR|RL|RR)$/.test(o.name))names.push(o.name);});
  return {meshes,triangles,vertices,rotors:names};
 });
 if(stats.rotors.length!==4)throw Error('Expected four independent rotors');
 if(errors.length)throw Error(errors.join('\n'));
 const report={...stats,bytes:bytes.length,validationErrors:validation.issues.numErrors,validationWarnings:validation.issues.numWarnings,glbRoundTrip:'PASS',previewViews:6};
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));
 console.log(report);
}finally{await browser.close();}
