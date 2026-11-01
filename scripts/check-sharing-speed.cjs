const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function checkScheduler(){
 const {install}=require(root+'/utils/network-scheduler.js');
 const live=new Map();let highWater=0,completed=0,failures=0;
 const wx={request(o){live.set(o.url,o);highWater=Math.max(highWater,live.size);return{abort(){live.delete(o.url);o.fail?.({errMsg:'request:fail abort'});o.complete?.({});},onHeadersReceived(fn){fn({});}};}};
 install(wx);const installed=wx.request;install(wx);assert.equal(wx.request,installed);
 const tasks=Array.from({length:12},(_,i)=>wx.request({url:'/api/config/'+i,complete(){completed++},fail(){failures++}}));
 assert.equal(live.size,4);
 wx.request({url:'/api/user/profile'});wx.request({url:'/api/location-sharing/sessions'});
 assert.equal(live.size,6);
 let headers=0;tasks[10].onHeadersReceived(()=>headers++);
 tasks[11].abort();tasks[11].abort();assert.equal(failures,1);assert.equal(completed,1);
 while(live.size){const [url,o]=live.entries().next().value;live.delete(url);o.success?.({});o.complete?.({});}
 assert.equal(completed,12);assert.equal(headers,1);assert.equal(highWater,6);
 console.log('PASS global request limit, reserved sharing slots, queued cancellation, callback compatibility');
}
function loadPage(source){
 let page;let calls=[];let avatarDownloads=0;
 const sharing={request(method,path,data){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});promise.abort=()=>reject({message:'abort'});calls.push({method,path,data,resolve,reject});return promise;},normalizeParticipant:p=>p,isTransient:()=>true};
 const context={console,Map,Set,Promise,Date,setTimeout,clearTimeout,setInterval,clearInterval,Page:p=>page=p,
 wx:{},require(name){if(name.includes('map-page'))return{createMapPage:()=>({data:{},onLoad(){},onShow(){},onHide(){},onUnload(){}})};
 if(name==='../utils/sharing')return sharing;
 if(name==='../../../utils/profile')return{getAuthToken:()=> 'fixture'};
 if(name.includes('map-overview'))return{query:(p,index)=>({page:index})};
 if(name.includes('map-compass'))return{invalidateCompassRead(){}};
 if(name.includes('quick-interaction'))return{async loadAvatar(source){avatarDownloads++;return 'local:'+source;}};
 if(name.includes('meetup-map'))return{install(){}};
 return{};}};
 vm.runInNewContext(source,context);
 Object.assign(page,{_sharingVisible:true,_sharingSession:'test',_sharingGeneration:1,_sharingCenterVersion:0,
 data:{sharingPage:0},setData(value){Object.assign(this.data,value)},renderSharingPeople(){},stopSharingLocationUpdates(){}});
 return{page,calls,sharing,avatarDownloads:()=>avatarDownloads};
}
async function checkPage(source,label){
 const {page,calls}=loadPage(source);
 const first=page.refreshSharingView(0,true);await flush();assert.equal(calls.length,1);
 for(let i=1;i<=6;i++)page.refreshSharingView(i);
 assert.equal(calls.length,1);
 calls[0].resolve({page:0,total:99,participants:[{id:'old'}]});await flush();
 assert.equal(calls.length,2);assert.equal(calls[1].data.page,6);assert.notEqual(page._sharingTotal,99);
 calls[1].resolve({page:6,total:7,participants:[{id:'new'}]});await first;
 assert.equal(page._sharingPeople[0].id,'new');assert.equal(page.data.sharingPage,6);
 const pending=page.refreshSharingView(0);await flush();page.onHide();await pending;
 assert.equal(page.data.sharingError,false);
 page._sharingVisible=true;page._sharingLastSuccess=Date.now();page._sharingLocationUpdates=true;
 const heartbeat=page.refreshSharing(1,false);await flush();calls.at(-1).reject(new Error('offline'));await heartbeat;
 clearTimeout(page._sharingTimer);assert.equal(page._sharingPeople[0].id,'new');assert.match(page.data.sharingStatus,/重新连接/);
 page._sharingLastSuccess=Date.now()-46000;
 const stale=page.refreshSharing(1,false);await flush();calls.at(-1).reject(new Error('offline'));await stale;
 clearTimeout(page._sharingTimer);assert.equal(page._sharingPeople.length,0);
 console.log('PASS '+label+': single flight/latest viewport, hidden-page cancellation, short failure retention, stale snapshot expiry');
}
async function checkStartup(source){
 const {page,calls,sharing}=loadPage(source);page._sharingSession=null;
 let profileDone,locationDone,profileStarted=false,locationStarted=false;
 page.ensureSharingProfile=()=>{profileStarted=true;return new Promise(r=>profileDone=r)};
 sharing.getPosition=()=>{locationStarted=true;return new Promise(r=>locationDone=r)};
 page.startSharingLocationUpdates=()=>{};page.setMyLocationControlPoint=()=>{};page.centerOnPoint=()=>{};
 const start=page.startSharing();await flush();
 assert.equal(profileStarted,true);assert.equal(locationStarted,true);assert.equal(calls.length,0);
 locationDone({latitude:31,longitude:121});await flush();assert.equal(calls.length,0,'position is not uploaded until profile verification passes');
 profileDone(true);await flush();assert.equal(calls.length,1);
 calls[0].resolve({sessionId:'new',self:{id:'self',member:true}});await flush();
 assert.equal(calls.length,2);calls[1].resolve({participants:[],mapParticipants:[],total:0});await start;
 clearTimeout(page._sharingTimer);
 console.log('PASS parallel profile/location preparation; no location upload before profile approval');
}
async function checkAvatarCache(source){
 const fixture=loadPage(source),{page}=fixture;
 page.onLoad({});page._sharingAvatarRevision=1;
 for(let i=0;i<300;i++){page.ensureSharingAvatar({avatarSource:'avatar-'+i});await flush();}
 assert.equal(page._sharingAvatarFiles.size,300);
 for(let i=0;i<300;i++)page.ensureSharingAvatar({avatarSource:'avatar-'+i});
 await flush();assert.equal(fixture.avatarDownloads(),300,'dense maps must not evict and redownload their own avatars');
 page.onLoad({});page._sharingAvatarRevision=1;page.ensureSharingAvatar({avatarSource:'avatar-299'});
 await flush();assert.equal(fixture.avatarDownloads(),300,'new page reuses decoded avatar cache');
 console.log('PASS dense-map avatar caching and cross-page reuse');
}
(async()=>{await checkScheduler();await checkPage(fs.readFileSync(root+'/packages/location-sharing/index/index.js','utf8'),'mini');
 await checkStartup(fs.readFileSync(root+'/packages/location-sharing/index/index.js','utf8'));
 await checkAvatarCache(fs.readFileSync(root+'/packages/location-sharing/index/index.js','utf8'));
 const modules={};vm.runInNewContext(fs.readFileSync('D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity/drone-game-sharing.js','utf8'),{MiniSource:{modules}});
 const source=modules['packages/location-sharing/index/index.js'].toString();
 await checkPage(source.slice(source.indexOf('{')+1,source.lastIndexOf('}')),'Android bundled module');
})().catch(e=>{console.error(e);process.exitCode=1});
