const esbuild=require('esbuild'),vm=require('vm'),assert=require('assert/strict');
(async()=>{
 const {outputFiles}=await esbuild.build({entryPoints:['src/games/drone-race/controller.ts'],bundle:true,format:'iife',globalName:'controller',write:false});
 let now=0;const handlers={};const context={window:{addEventListener:(name,fn)=>handlers[name]=fn,DroneGameNative:{postMessage(){}}},performance:{now:()=>now},localStorage:{getItem:()=>null,setItem(){}},setTimeout,clearTimeout};
 vm.createContext(context);vm.runInContext(outputFiles[0].text,context);
 const c=context.controller;
 const send=(axes,extra={})=>context.window.__droneControllerFrame({axes,fresh:true,takeover:true,sampleAgeMs:0,...extra});
 assert.equal(c.controllerInput(),null);
 send([0,1,1,1,0]);let input=c.controllerInput();assert.equal(input.steer,1);assert.equal(input.lift,1);assert.equal(input.boost,true);assert.equal(input.brake,false);
 send([0,-1,-1,-1,0]);input=c.controllerInput();assert.equal(input.steer,-1);assert.equal(input.lift,-1);assert.equal(input.brake,true);assert.equal(input.boost,false);
 send([0,0,.03,-.03,0]);assert.equal(c.controllerInput().steer,0);assert.equal(c.controllerInput().lift,0);
 c.setControllerSettings({invertSteer:true,invertLift:true,invertThrottle:true});send([0,1,1,1,0]);input=c.controllerInput();assert.equal(input.steer,-1);assert.equal(input.lift,-1);assert.equal(input.brake,true);
 now=299;assert(c.controllerInput());now=300;assert.equal(c.controllerInput(),null);
 send([0,0,0,0,0],{sampleAgeMs:280});now=321;assert.equal(c.controllerInput(),null);
 send([0,1,0,0,0],{takeover:false});assert.equal(c.controllerInput(),null);
 send([0,1,0,0,0]);handlers.blur();assert.equal(c.controllerInput(),null);
 console.log('Controller input: axes, deadzone, invert settings, throttle exclusivity, stale samples and blur passed.');
})();
