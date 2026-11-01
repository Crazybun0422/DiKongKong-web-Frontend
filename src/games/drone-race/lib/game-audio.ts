import {audioUrl} from './assets';
import {crashRandom} from './crash-effects';
import type {Flight} from './drone';
import type {CourseId} from './courses';

export type AudioSettings={muted:boolean;music:number;effects:number;voice:number};
export const DEFAULT_AUDIO:AudioSettings={muted:false,music:.22,effects:.55,voice:.8};
type Cue='countdown'|'launch'|'gate-pass'|'crash'|'finish';
const clamp=(n:number)=>Math.max(0,Math.min(1,n));

class GameAudio{
 settings:AudioSettings={...DEFAULT_AUDIO};
 private context:AudioContext|null=null;
 private master:GainNode|null=null;private musicBus:GainNode|null=null;private effectsBus:GainNode|null=null;
 private courseId:CourseId='valley';private musicLoading=new Map<string,Promise<void>>();
 private buffers=new Map<string,AudioBuffer>();private loading:Promise<void>|null=null;
 private music:AudioBufferSourceNode|null=null;private rotorGain:GainNode|null=null;private windGain:GainNode|null=null;
 private rotors:OscillatorNode[]=[];private wind:AudioBufferSourceNode|null=null;
 private inRace=false;private launched=false;private ended=false;private countdown:number|null=null;private gate=0;private passed=0;
 private impactVoiceAt=0;private lastBoost=false;private lastUpdate=0;private duckUntil=0;private speechSerial=0;private restored=false;
 private listeners=new Set<()=>void>();private oneShots=new Set<AudioBufferSourceNode>();private tones=new Set<OscillatorNode>();
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 private changed(){for(const fn of this.listeners)fn();}
 restore(){if(this.restored||typeof window==='undefined')return;this.restored=true;try{const saved=JSON.parse(localStorage.getItem('drone-audio')??'null');if(saved&&typeof saved==='object'){for(const key of['music','effects','voice'] as const)if(Number.isFinite(saved[key]))this.settings[key]=clamp(saved[key]);this.settings.muted=saved.muted===true;}}catch{}this.changed();}
 configure(patch:Partial<AudioSettings>){this.restore();this.settings={...this.settings,...patch};for(const key of['music','effects','voice'] as const)this.settings[key]=clamp(this.settings[key]);try{localStorage.setItem('drone-audio',JSON.stringify(this.settings));}catch{}this.applyVolume();if(this.settings.muted||this.settings.voice===0)this.cancelVoice();this.changed();}
 private applyVolume(){if(!this.context)return;const t=this.context.currentTime;this.master?.gain.setTargetAtTime(this.settings.muted?0:.8,t,.04);this.effectsBus?.gain.setTargetAtTime(this.settings.effects,t,.05);this.musicBus?.gain.setTargetAtTime(this.settings.music*(this.ended?0:performance.now()<this.duckUntil?.27:1),t,.1);}
 async unlock(){if(typeof window==='undefined')return;this.restore();if(!this.context){try{const Audio=window.AudioContext??(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!Audio)return;this.context=new Audio();this.master=this.context.createGain();const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-8;limiter.ratio.value=6;limiter.attack.value=.004;limiter.release.value=.16;this.master.connect(limiter).connect(this.context.destination);this.musicBus=this.context.createGain();this.effectsBus=this.context.createGain();this.musicBus.connect(this.master);this.effectsBus.connect(this.master);this.applyVolume();}catch{return;}}
  if(this.context.state==='suspended'&&!document.hidden)await this.context.resume().catch(()=>{});void this.preload();
 }
 private preload(){if(this.loading||!this.context)return this.loading;const context=this.context;this.loading=Promise.all(['countdown','launch','gate-pass','impact-obstacle','impact-gate','impact-ground','finish'].map(async name=>{try{const r=await fetch(audioUrl(name));if(!r.ok)return;const buffer=await context.decodeAudioData(await r.arrayBuffer());this.buffers.set(name,buffer);}catch{}})).then(()=>{if(this.inRace&&this.launched&&!this.ended)this.startMusic();});return this.loading;}
 private prepareMusic(){
  const name=`music-${this.courseId}`;if(!this.context||this.buffers.has(name)||this.musicLoading.has(name))return;const context=this.context;
  const pending=(async()=>{try{const response=await fetch(audioUrl(name));if(!response.ok)return;const buffer=await context.decodeAudioData(await response.arrayBuffer());if(name!==`music-${this.courseId}`)return;for(const key of this.buffers.keys())if(key.startsWith('music-'))this.buffers.delete(key);this.buffers.set(name,buffer);if(this.inRace&&this.launched&&!this.ended)this.startMusic();}catch{}finally{this.musicLoading.delete(name);}})();this.musicLoading.set(name,pending);
 }
 private stopMusic(){if(this.music){try{this.music.stop();}catch{}this.music.disconnect();this.music=null;}}
 private startMusic(){if(this.music||!this.context||!this.musicBus||!this.inRace||this.ended)return;const buffer=this.buffers.get(`music-${this.courseId}`);if(!buffer)return;const source=this.context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(this.musicBus);source.start();this.music=source;this.applyVolume();}
 private cue(name:Cue){if(!this.context||!this.effectsBus||this.settings.muted||document.hidden)return;const buffer=this.buffers.get(name);if(!buffer){this.beep(name==='launch'?760:name==='crash'?105:460,.14);return;}const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.effectsBus);this.oneShots.add(source);source.onended=()=>{source.disconnect();this.oneShots.delete(source);};source.start();}
 private crashSound(state:Flight){
  const c=this.context;if(!c||!this.effectsBus||this.settings.muted||document.hidden)return;
  const random=crashRandom(state.crashSeed??Math.floor(Math.random()*4294967296));
  const recorded=this.buffers.get(`impact-${state.crashReason??'obstacle'}`);
  if(recorded){const source=c.createBufferSource(),gain=c.createGain();source.buffer=recorded;source.playbackRate.value=.92+random()*.16;gain.gain.value=1.45+Math.min(.20,(state.impactSpeed??25)/220);source.connect(gain).connect(this.effectsBus);this.oneShots.add(source);source.onended=()=>{source.disconnect();gain.disconnect();this.oneShots.delete(source);};source.start();return;}
  const metal=state.crashReason==='gate',ground=state.crashReason==='ground',variant=Math.floor(random()*3),duration=.9+random()*.35,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0),pitch=(metal?780:ground?95:210)*(1+variant*.22),rate=.87+random()*.28;
  let low=0,peak=0;const impacts=Array.from({length:5},()=>({at:.09+random()*.55,hz:650+random()*2400,amp:.035+random()*.045}));
  for(let i=0;i<data.length;i++){const t=i/c.sampleRate,noise=random()*2-1;low=low*.91+noise*.09;let v=(noise*(metal?.40:ground?.32:.46)+low*1.2)*Math.exp(-t*(ground?9:14));v+=Math.sin(2*Math.PI*pitch*t)*Math.exp(-t*(metal?8:24))*.32+Math.sin(2*Math.PI*(95*t-21*t*t))*Math.exp(-t*13)*.68+noise*Math.exp(-t*120)*.8;for(const hit of impacts){const d=t-hit.at;if(d>0&&d<.16)v+=(Math.sin(d*hit.hz*6.283)+noise*.5)*Math.exp(-d*35)*hit.amp;}data[i]=v;peak=Math.max(peak,Math.abs(v));}
  for(let i=0;i<data.length;i++)data[i]*=.88/Math.max(.88,peak);
  const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=1.45+Math.min(.20,(state.impactSpeed??25)/160);source.connect(gain).connect(this.effectsBus);this.oneShots.add(source);source.onended=()=>{source.disconnect();gain.disconnect();this.oneShots.delete(source);};source.start();
 }
 private beep(hz:number,seconds:number){const c=this.context;if(!c||!this.effectsBus)return;const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(hz,c.currentTime);g.gain.setValueAtTime(.12,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+seconds);o.connect(g).connect(this.effectsBus);this.tones.add(o);o.start();o.stop(c.currentTime+seconds);o.onended=()=>{o.disconnect();g.disconnect();this.tones.delete(o);};}
 voiceAvailable(){return typeof window!=='undefined'&&'speechSynthesis'in window&&speechSynthesis.getVoices().some(v=>/^zh([_-]|$)/i.test(v.lang));}
 private say(text:string){if(typeof window==='undefined'||!('speechSynthesis'in window)||this.settings.muted||this.settings.voice===0||document.hidden)return;const voice=speechSynthesis.getVoices().find(v=>/^zh[-_]CN$/i.test(v.lang))??speechSynthesis.getVoices().find(v=>/^zh/i.test(v.lang));if(!voice)return;this.cancelVoice();const serial=++this.speechSerial,u=new SpeechSynthesisUtterance(text);u.voice=voice;u.lang=voice.lang;u.rate=1.07;u.pitch=1;u.volume=this.settings.voice;this.duckUntil=performance.now()+2500;this.applyVolume();const done=()=>{if(serial===this.speechSerial){this.duckUntil=0;this.applyVolume();}};u.onend=done;u.onerror=done;speechSynthesis.speak(u);}
 private cancelVoice(){this.impactVoiceAt=0;this.speechSerial++;if(typeof window!=='undefined'&&'speechSynthesis'in window)speechSynthesis.cancel();this.duckUntil=0;this.applyVolume();}
 testVoice(){void this.unlock();this.say('准备起飞。');}
 beginRace(courseId:CourseId='valley'){this.endRace();this.courseId=courseId;this.inRace=true;this.launched=false;this.ended=false;this.countdown=null;this.gate=0;this.passed=0;this.lastBoost=false;this.applyVolume();void this.unlock().then(()=>this.prepareMusic());}
 private createFlightSound(){const c=this.context;if(!c||!this.effectsBus||this.rotors.length)return;this.rotorGain=c.createGain();this.rotorGain.gain.value=0;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=850;filter.Q.value=.6;this.rotorGain.connect(filter).connect(this.effectsBus);
  for(const [i,ratio]of[1,1.018,2.01].entries()){const o=c.createOscillator();o.type=i===2?'sine':'triangle';o.frequency.value=95*ratio;o.connect(this.rotorGain);o.start();this.rotors.push(o);}
  const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.035)/1.035;data[i]=last*3.2;}const source=c.createBufferSource();source.buffer=buffer;source.loop=true;const windFilter=c.createBiquadFilter();windFilter.type='highpass';windFilter.frequency.value=330;this.windGain=c.createGain();this.windGain.gain.value=0;source.connect(windFilter).connect(this.windGain).connect(this.effectsBus);source.start();this.wind=source;
 }
 update(s:Flight,remaining:number){if(!this.inRace)return;
  if(s.courseId&&s.courseId!==this.courseId){this.courseId=s.courseId;this.stopMusic();this.prepareMusic();}
  if(remaining>0){const number=Math.min(3,remaining);if(number!==this.countdown){this.countdown=number;this.cue('countdown');this.say(['','一','二','三'][number]);}return;}
  if(!this.launched){this.launched=true;this.cue('launch');this.say('起飞！');this.startMusic();this.createFlightSound();}
  if(!this.ended&&(s.crashed||s.finished)){this.ended=true;if(s.crashed){this.cancelVoice();this.crashSound(s);this.impactVoiceAt=performance.now()+750;}else{this.cue('finish');this.say('比赛完成！');}this.applyVolume();}
  if(this.impactVoiceAt&&performance.now()>=this.impactVoiceAt){this.impactVoiceAt=0;this.say('飞行结束。');}
  if(!this.ended&&s.lastGate&&s.lastGate.distance>this.gate){this.gate=s.lastGate.distance;if(s.lastGate.success){this.passed++;this.cue('gate-pass');if(this.passed===1||this.passed%4===0)this.say('穿越成功。');}else this.say('漏过光环。');}
  if(!this.ended&&s.boosting&&!this.lastBoost)this.beep(220,.12);this.lastBoost=!!s.boosting;
  const c=this.context;if(!c||c.currentTime-this.lastUpdate<.05)return;this.lastUpdate=c.currentTime;const velocity=this.ended?0:Math.min(1,s.speed/72),boost=s.boosting?1:0;this.rotorGain?.gain.setTargetAtTime(velocity*.065,c.currentTime,.10);this.windGain?.gain.setTargetAtTime(velocity*(.12+boost*.06),c.currentTime,.13);this.rotors.forEach((o,i)=>o.frequency.setTargetAtTime((96+velocity*95+boost*22)*[1,1.018,2.01][i],c.currentTime,.09));this.applyVolume();
 }
 visibility(){if(!this.context)return;if(document.hidden){this.cancelVoice();this.stopCues();void this.context.suspend();}else if(this.inRace)void this.context.resume().catch(()=>{});}
 private stopCues(){for(const s of this.oneShots){try{s.stop();}catch{}s.disconnect();}this.oneShots.clear();for(const o of this.tones){try{o.stop();}catch{}o.disconnect();}this.tones.clear();}
 endRace(){this.inRace=false;this.cancelVoice();this.stopMusic();for(const o of this.rotors){try{o.stop();}catch{}o.disconnect();}this.rotors=[];if(this.wind){try{this.wind.stop();}catch{}this.wind.disconnect();this.wind=null;}this.rotorGain?.disconnect();this.windGain?.disconnect();this.rotorGain=null;this.windGain=null;this.stopCues();this.lastUpdate=0;}
}
export const gameAudio=new GameAudio();
