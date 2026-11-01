import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const output=path.resolve('artifacts/aircraft-model-inspire3-v02');
const require=createRequire(import.meta.url);
const validator=require(path.resolve('artifacts/aircraft-model-mini4pro-v01/tools/node_modules/gltf-validator'));
const browser=await chromium.launch({headless:true});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1.5});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:17840/?build=1');
 await page.waitForFunction(()=>window.modelReady||window.modelError,{},{timeout:90000});
 const error=await page.evaluate(()=>window.modelError);if(error)throw Error(error);
 const data=await page.evaluate(()=>window.exportGLB());
 const bytes=Buffer.from(data,'base64');await fs.writeFile(path.join(output,'inspire-3.glb'),bytes);
 const validation=await validator.validateBytes(new Uint8Array(bytes),{uri:'inspire-3.glb'});
 await fs.writeFile(path.join(output,'gltf-validation.json'),JSON.stringify(validation,null,2));
 if(validation.issues.numErrors)throw Error('GLB validation errors: '+JSON.stringify(validation.issues));
 await page.goto('http://127.0.0.1:17840/');
 await page.waitForFunction(()=>window.modelReady||window.modelError,{},{timeout:90000});
 if(await page.evaluate(()=>window.modelError))throw Error(await page.evaluate(()=>window.modelError));
 await fs.mkdir(path.join(output,'preview'),{recursive:true});
 for(const view of ['hero','front','side','top','bottom','detail']) {
  await page.evaluate(v=>window.setView(v),view);
  await page.waitForTimeout(500);
  await page.screenshot({path:path.join(output,'preview',view+'.png')});
 }
 const stats=await page.evaluate(()=>{
  let meshes=0,triangles=0,vertices=0;const names=[],materials=new Set(),textures=new Set();
  window.assetRoot.traverse(o=>{
   if(o.isMesh){
    meshes++;vertices+=o.geometry.attributes.position.count;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;
    for(const material of Array.isArray(o.material)?o.material:[o.material]){
     materials.add(material.uuid);
     for(const value of Object.values(material))if(value?.isTexture)textures.add(value.uuid);
    }
   }
   if(/^Rotor_(FL|FR|RL|RR)$/.test(o.name))names.push(o.name);
  });
  return {meshes,triangles,vertices,materials:materials.size,textures:textures.size,rotors:names,hasCameraDetail:!!window.assetRoot.getObjectByName('Camera')};
 });
 if(stats.rotors.length!==4)throw Error('Expected four independent rotors');
 if(!stats.hasCameraDetail)throw Error('Camera detail node is missing');
 await page.click('#propellers');
 const propellerState=await page.evaluate(()=>['FL','FR','RL','RR'].map(suffix=>({propeller:window.assetRoot.getObjectByName('Propeller_'+suffix)?.visible,rotor:window.assetRoot.getObjectByName('Rotor_'+suffix)?.visible})));
 if(propellerState.some(state=>state.propeller!==false||state.rotor!==true))throw Error('Propeller toggle must hide blades without hiding motor nodes');
 await page.click('#propellers');
 if(await page.evaluate(()=>['FL','FR','RL','RR'].some(suffix=>window.assetRoot.getObjectByName('Propeller_'+suffix)?.visible!==true)))throw Error('Propeller visibility did not restore');
 const rotorPose=()=>page.evaluate(()=>window.assetRoot.getObjectByName('Rotor_FL').quaternion.toArray());
 const originalPose=await rotorPose();
 await page.click('#spin');
 await page.waitForTimeout(400);
 const spinningPose=await rotorPose();
 if(spinningPose.every((v,i)=>Math.abs(v-originalPose[i])<1e-6))throw Error('Rotor animation did not move');
 await page.click('#reset');
 const resetPose=await rotorPose();
 if(resetPose.some((v,i)=>Math.abs(v-originalPose[i])>1e-6))throw Error('Reset did not restore rotor pose');
 const mobileWidths=[320,390,700];
 for(const width of mobileWidths){
  await page.setViewportSize({width,height:844});
  await page.waitForTimeout(150);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile layout overflow at width '+width);
 }
 if(errors.length)throw Error(errors.join('\n'));
 const report={...stats,bytes:bytes.length,validationErrors:validation.issues.numErrors,validationWarnings:validation.issues.numWarnings,glbRoundTrip:'PASS',previewViews:6,propellerVisibility:'PASS',rotorAnimation:'PASS',reset:'PASS',mobileWidths};
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));
 console.log(report);
}finally{await browser.close();}
