const fs=require('fs'),path=require('path');
const staged=path.join(__dirname,'online-feature');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const backend='E:/source_code/wechat/DiKongKong-Backend/src/main/java/com/example/dikongkongbackend';
function edit(file,from,to){const code=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');if(!code.includes(from))throw Error('Missing anchor: '+file+' '+from);fs.writeFileSync(file,code.replace(from,to));}
function copy(name,target){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(staged,name),target);}
copy('FlightMeetupOnlineService.java',backend+'/service/FlightMeetupOnlineService.java');
copy('FlightMeetupOnlineController.java',backend+'/controller/FlightMeetupOnlineController.java');
edit(backend+'/service/LocationSharingService.java','    public List<Participant> enrichParticipants(List<Participant> participants) {',`    /** Read only explicit, unexpired sharing sessions; never private location history. */
    public Map<String, Position> sharedPositions(List<String> codes) {
        if (codes.isEmpty()) return Map.of();
        List<String> values = redis.opsForValue().multiGet(codes.stream().map(code -> PREFIX + code).toList());
        Map<String, Position> result = new HashMap<>();
        long now = clock.millis();
        for (String value : values == null ? Collections.<String>emptyList() : values) {
            Session session = decode(value);
            if (session == null || session.self() == null || expiredAt(session) <= now) continue;
            Participant p = session.self();
            if (!Double.isFinite(p.latitude()) || !Double.isFinite(p.longitude())
                    || Math.abs(p.latitude()) > 90 || Math.abs(p.longitude()) > 180) continue;
            result.put(p.id(), new Position(p.latitude(), p.longitude(), null));
        }
        return result;
    }

    public List<Participant> enrichParticipants(List<Participant> participants) {`);
copy('online-people.js',mini+'/packages/flight-meetups/online-people.js');
for(const ext of ['js','wxml','wxss'])copy('online-index.'+ext,mini+'/packages/flight-meetups/online/index.'+ext);
fs.writeFileSync(mini+'/packages/flight-meetups/online/index.json',JSON.stringify({navigationStyle:'custom',disableScroll:true,backgroundColor:'#fcfeff'}));
const app=JSON.parse(fs.readFileSync(mini+'/app.json','utf8'));
app.subpackages.find(p=>p.root==='packages/flight-meetups').pages.push('online/index');
fs.writeFileSync(mini+'/app.json',JSON.stringify(app,null,2)+'\n');
const index=mini+'/packages/flight-meetups/index/index';
edit(index+'.js',"const brandOrbit=require('./brand-orbit');","const brandOrbit=require('./brand-orbit');\nconst onlinePeople=require('../online-people');");
edit(index+'.js',"data:{mode:'entry',","data:{onlinePreview:[],mode:'entry',");
edit(index+'.js','onShow(){this._visible=true;','onShow(){this._visible=true;this.loadOnlinePreview();clearInterval(this._onlineTimer);this._onlineTimer=setInterval(()=>{if(this.data.mode===\'entry\')this.loadOnlinePreview();},30000);');
edit(index+'.js','onHide(){this._visible=false;','onHide(){this._visible=false;clearInterval(this._onlineTimer);');
edit(index+'.js','  noop(){},',`  onOnline(){wx.navigateTo({url:'/packages/flight-meetups/online/index'});},
  async loadOnlinePreview(){
    if(this._onlineLoading)return;this._onlineLoading=true;
    try{const result=await onlinePeople.list(0,5);if(this._visible&&!this._unloaded)this.setData({onlinePreview:(result.items||[]).slice(0,5).map(onlinePeople.decorate)});}catch(_){}finally{this._onlineLoading=false;}
  },
  noop(){},`);
edit(index+'.wxml',`      <text class="yf-heading">一起飞，
去遇见同好。</text>`,`      <view class="yf-entry-heading"><text class="yf-heading">一起飞，
去遇见同好。</text><view class="yf-online-entry" bindtap="onOnline" role="button" aria-label="当前在线">
        <view class="yf-online-label"><text>当前在线</text><text class="yf-online-arrow">›</text></view>
        <view wx:if="{{onlinePreview.length}}" class="yf-online-stack"><image wx:for="{{onlinePreview}}" wx:key="featureCode" class="yf-online-avatar" src="{{item.avatarUrl}}" mode="aspectFill" binderror="onAvatarError" data-image-path="onlinePreview[{{index}}].avatarUrl" data-source="{{item.avatarUrl}}" data-avatar="{{true}}"/><view class="yf-online-fade"></view></view>
      </view></view>`);
fs.appendFileSync(index+'.wxss',`\n/* Compact live roster entry, aligned with the existing hero heading. */
.yf-entry-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.yf-entry-heading .yf-heading{flex:1;min-width:0;white-space:pre;letter-spacing:-1.5px}.yf-online-entry{flex:0 0 112px;min-height:58px;display:flex;flex-direction:column;justify-content:center;gap:8px}.yf-online-label{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#294768}.yf-online-arrow{color:#7191ae;font-size:18px;line-height:16px}.yf-online-stack{position:relative;display:flex;align-items:center;width:112px;height:30px;overflow:hidden}.yf-online-avatar{box-sizing:border-box;display:block;width:28px;height:28px;flex:0 0 28px;border:2px solid #fcfeff;border-radius:50%;margin-left:-8px;background:#edf5ff}.yf-online-avatar:first-child{margin-left:0}.yf-online-fade{position:absolute;right:0;top:0;bottom:0;width:27px;background:linear-gradient(90deg,rgba(252,254,255,0),#fcfeff);pointer-events:none}@media(max-width:350px){.yf-entry{padding-left:16px;padding-right:16px}.yf-entry-heading .yf-heading{font-size:25px}.yf-online-entry{flex-basis:104px}.yf-online-stack{width:104px}}\n`);
console.log('Applied online feature to mini-program and backend.');
