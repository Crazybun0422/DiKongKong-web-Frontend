const fs=require('fs'),path=require('path'),vm=require('vm');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram',android='D:/Workspace/LowLatitudePlanet';
const helper='utils/personal-location.js';
fs.copyFileSync('scripts/personal-location.js',mini+'/'+helper);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const changed=[];
for(const file of walk(mini).filter(f=>f.endsWith('.js')&&path.resolve(f)!==path.resolve(mini,helper))){
 let s=fs.readFileSync(file,'utf8');if(!s.includes('wx.getLocation('))continue;
 if(file.replaceAll('\\','/').endsWith('/packages/flight-meetups/online-people.js')){
  s=s.replace(/const \{ uploadUserLocation \} = require\('\.\.\/\.\.\/utils\/profile'\);[\s\S]*?(?=function distanceStyle)/,'').replace('reportPosition(point); ','');
 }
 let relative=path.relative(path.dirname(file),mini+'/'+helper).replaceAll('\\','/').replace(/\.js$/,'');if(!relative.startsWith('.'))relative='./'+relative;
 s=s.replaceAll('wx.getLocation(',`require(${JSON.stringify(relative)}).getLocation(`);
 fs.writeFileSync(file,s);changed.push(path.relative(mini,file).replaceAll('\\','/'));
}
fs.writeFileSync('artifacts/personal-location-files.json',JSON.stringify(changed,null,2));
const base=android+'/app/src/main/java/cn/llplanet/lowlatitudeplanet';
fs.writeFileSync(base+'/data/PersonalLocationReporter.kt',`package cn.llplanet.lowlatitudeplanet.data

import kotlinx.coroutines.*
import org.json.JSONObject

/** Persists real GCJ-02 fixes independently of public location sharing. */
class PersonalLocationReporter(private val api:PlanetApi) {
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO)
    private val gate=PersonalLocationGate()
    fun report(latitude:Double,longitude:Double) {
        if(!latitude.isFinite() || !longitude.isFinite() || kotlin.math.abs(latitude)>90 || kotlin.math.abs(longitude)>180 || api.token.isBlank())return
        val identity=api.base+"|"+api.token
        if(!gate.begin(identity,System.currentTimeMillis()))return
        scope.launch {
            var success=false
            try {
                if(identity!=api.base+"|"+api.token)return@launch
                val response=api.json("/api/user/location",true,JSONObject().put("latitude",latitude).put("longitude",longitude))
                success=response.optBoolean("success",true)
            } catch(e:CancellationException){throw e} catch(_:Exception) {
                // Next real fix retries after the short failure backoff; location UI stays usable.
            } finally {gate.finish(identity,System.currentTimeMillis(),success)}
        }
    }
}

internal class PersonalLocationGate {
    private var identity=""
    private var pending=false
    private var attempted:Long?=null
    private var succeeded:Long?=null
    @Synchronized fun begin(key:String,now:Long):Boolean {
        if(identity!=key){identity=key;pending=false;attempted=null;succeeded=null}
        if(pending || succeeded?.let {now-it<30000}==true || attempted?.let {now-it<5000}==true)return false
        pending=true;attempted=now;return true
    }
    @Synchronized fun finish(key:String,now:Long,success:Boolean) {
        if(identity!=key)return
        pending=false;if(success)succeeded=now
    }
}
`);
function edit(file,a,b){const s=fs.readFileSync(file,'utf8');if(!s.includes(a))throw Error(a);fs.writeFileSync(file,s.replace(a,b));}
edit(base+'/PlanetApplication.kt','    val api by lazy', '    val personalLocation by lazy { cn.llplanet.lowlatitudeplanet.data.PersonalLocationReporter(api) }\n    val api by lazy');
edit(base+'/map/NativeLocationLayer.kt','        accuracy=location.accuracy','        val saved=Geo.toGcj(GeoPoint(location.latitude,location.longitude))\n        (context.applicationContext as cn.llplanet.lowlatitudeplanet.PlanetApplication).personalLocation.report(saved.lat,saved.lng)\n        accuracy=location.accuracy');
edit(base+'/map/MiniDevice.kt','        val p=if(type=="wgs84")raw else Geo.toGcj(raw)','        val saved=Geo.toGcj(raw)\n        (context.applicationContext as cn.llplanet.lowlatitudeplanet.PlanetApplication).personalLocation.report(saved.lat,saved.lng)\n        val p=if(type=="wgs84")raw else saved');
// Native Android callbacks already report once through a process-wide throttler.
// Register the shared helper for subsequently compiled parity pages without double uploads.
const compiler=android+'/scripts/sync-mini-parity.cjs',source=fs.readFileSync(compiler,'utf8');
const prefix=source.slice(0,source.indexOf('function addDefinition(route)'));
vm.runInNewContext(prefix+`let bundle='MiniSource.modules["utils/personal-location.js"]=function(require,module,exports){module.exports={getLocation:options=>wx.getLocation(options),reportPosition:()=>Promise.resolve(false)};};\\n';
const file='packages/flight-meetups/online-people.js';bundle+='MiniSource.modules['+JSON.stringify(file)+']=function(require,module,exports,Page,Component,App,_t){\\n'+localize(read(file))+'\\n};\\n';
fs.writeFileSync(path.join(out,'personal-location.js'),bundle);
const entry=path.join(out,'index.html');let html=fs.readFileSync(entry,'utf8');if(!html.includes('src="personal-location.js"'))html=html.replace('<script src="runtime.js">','<script src="personal-location.js"></script><script src="runtime.js">');fs.writeFileSync(entry,html);`,{require,__dirname:path.dirname(compiler),process:{argv:[]},console});
console.log('Connected '+changed.length+' Mini Program GPS callers and both Android native GPS paths to persistent location reporting.');
