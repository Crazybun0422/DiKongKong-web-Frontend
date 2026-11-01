import type {Drone,Flight} from './drone';
export const CRUISE_ROTOR_RATE=24,BOOST_ROTOR_RATE=CRUISE_ROTOR_RATE*3;
export type RotorMotion={phase:number;rate:number;from:number;target:number;age:number};
export const initialRotorMotion=():RotorMotion=>({phase:0,rate:CRUISE_ROTOR_RATE,from:CRUISE_ROTOR_RATE,target:CRUISE_ROTOR_RATE,age:0});
// Integrate angular velocity: multiplying absolute time by a changing rate would jump.
export function advanceRotor(m:RotorMotion,boost:boolean,dt:number,stopped=false):RotorMotion{
 if(stopped)return {...m,rate:0,from:0,target:0,age:0};
 const target=boost?BOOST_ROTOR_RATE:CRUISE_ROTOR_RATE,from=target===m.target?m.from:m.rate,previousAge=target===m.target?m.age:0,duration=target>from?.18:.22,delta=Math.max(0,Math.min(dt,.1)),age=previousAge+delta;
 const progress=Math.min(1,age/duration),ease=progress*progress*(3-2*progress),rate=from+(target-from)*ease;
 return {phase:(m.phase+(m.rate+rate)*.5*delta)%(Math.PI*2),rate,from,target,age};
}
const rotors=new WeakMap<Drone,{time:number;motion:RotorMotion}>();
export function raceRotorPhase(drone:Drone,state:Flight,time:number){
 const old=rotors.get(drone),motion=advanceRotor(old?.motion??initialRotorMotion(),!!state.boosting&&!state.finished,old?Math.max(0,time-old.time):0,!!state.crashed);
 rotors.set(drone,{time,motion});return motion.phase;
}
