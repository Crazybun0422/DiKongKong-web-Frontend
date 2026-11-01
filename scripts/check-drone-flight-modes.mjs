import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';

const bundle=await build({stdin:{contents:"export {initialFlight,stepFlight} from './src/games/drone-race/lib/drone'; export {createAirframe} from './src/games/drone-race/lib/airframes';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'cjs',platform:'node'});
const module={exports:{}};runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports});
const engine=module.exports;
const drone=engine.createAirframe('dji-mini-4-pro');
// Hold position along the track to isolate attitude control from scenery/collisions.
const stationary={...drone,detail:{...drone.detail,maxKph:0}};
const run=(api,state,mode,steer,lift,seconds)=>{
 for(let i=0;i<Math.round(seconds*60);i++)state=api.stepFlight(state,stationary,steer,false,1/60,lift,false,mode);
 return state;
};
function verify(api){
 assert.equal(api.initialFlight().controlMode,'fpv');
 let state=run(api,api.initialFlight('valley',42),'fpv',.5,.5,.25);
 const bank=state.roll,pitch=state.pitch;
 assert(Math.abs(bank)>.05&&pitch>.05,'sticks change FPV attitude');
 const released=run(api,state,'fpv',0,0,.8);
 assert.equal(released.roll,bank,'FPV release does not auto-level roll');
 assert.equal(released.pitch,pitch,'FPV release does not auto-level pitch');
 assert(released.altitude>state.altitude&&released.x>state.x,'retained attitude keeps influencing flight');
 const corrected=run(api,released,'fpv',-.5,-.5,.25);
 assert(Math.abs(corrected.roll)<.001&&Math.abs(corrected.pitch)<.001,'opposite input levels the aircraft');
 const stabilized=run(api,released,'stabilized',0,0,1.2);
 assert(Math.abs(stabilized.roll)<.015&&Math.abs(stabilized.liftVelocity)<.01,'self-stabilized release levels and arrests climb');
 assert(stabilized.elapsed>released.elapsed&&stabilized.controlMode==='stabilized','switch preserves the current flight');
 assert(!stabilized.crashed);
}
verify(engine);
const require=createRequire(import.meta.url);
const mini=require('../../DiKongKong-wechat-mini/miniprogram/packages/drone-game/engine/engine.js');
verify(mini);
for(const mode of ['fpv','stabilized']){
 const expected=run(engine,engine.initialFlight('valley',42),mode,.3,.2,.5);
 const actual=run(mini,mini.initialFlight('valley',42),mode,.3,.2,.5);
 assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)),'mini and browser use identical flight physics');
}
console.log('PASS: FPV default, retained roll/pitch and motion, countersteering, self-level switch, shared mini/browser physics.');
