from pathlib import Path
B=Path('E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram')
def edit(path,old,new):
 p=B/path;s=p.read_text('utf-8');assert old in s,(path,old[:70]);p.write_text(s.replace(old,new),encoding='utf-8')
edit('packages/market/index/index.wxml','<text class="saving">立省 ¥{{item.flpText}}</text>','')
edit('packages/market/index/index.wxml','优惠前 ¥','原价 ¥')
edit('packages/market/index/index.wxss','gap:22px;min-width:100%;','gap:16px;')
edit('packages/market/index/index.wxss','.category-tab{position:', '.category-tab{width:auto!important;min-width:0;margin:0;position:')
edit('packages/market/index/index.wxss','min-height:142px','min-height:126px')
edit('packages/market/index/index.wxss','min-height:160px','min-height:144px')
edit('packages/market/api.js','getAuthToken, extractAvatarFileName','getAuthToken, loadStoredProfile, extractAvatarFileName')
edit('packages/market/api.js',"const product=p=>({...p,imageUrl:imageSrc(p.imageUrl),originalText:money(p.originalPrice),cashText:money(p.cashPrice),flpText:money(p.maxFlp)});",'''const price=p=>({...p,originalText:money(p.originalPrice),cashText:money(p.cashPrice),flpText:money(p.maxFlp)});
const product=p=>({...price(p),imageUrl:imageSrc(p.imageUrl),imageUrls:(p.imageUrls?.length?p.imageUrls:[p.imageUrl]).map(imageSrc).filter(Boolean),variants:(p.variants||[]).map(price)});
function addressKey(){const code=loadStoredProfile()?.featureCode;return getAuthToken()&&code?'marketShipping:'+code:null;}
function loadAddress(){try{const key=addressKey();return key?wx.getStorageSync(key)||{}:{};}catch(e){return {};}}
function saveAddress(data){try{const key=addressKey();if(key)wx.setStorageSync(key,{recipient:data.recipient,phone:data.phone,address:data.address});}catch(e){}}
''')
edit('packages/market/api.js','module.exports={request,','module.exports={loadAddress,saveAddress,request,')
p=B/'packages/market/detail/index.js';s=p.read_text('utf-8')
s=s.replace("data:{product:null,quantity:1,recipient:'',phone:'',address:'',cashText:'',flpText:'',busy:false,error:''},", "data:{product:null,selected:null,variantId:null,checkoutOpen:false,imageIndex:0,quantity:1,recipient:'',phone:'',address:'',cashText:'',flpText:'',busy:false,error:''},")
s=s.replace('onLoad(o){this.id=o.id;this.load();}', 'onLoad(o){this.id=o.id;this.setData(api.loadAddress());this.load();},\n onUnload(){this.rememberAddress();},\n rememberAddress(){api.saveAddress(this.data);},')
s=s.replace("this.setData({product:p,error:''});this.totals();", "const selected=p.variants.find(v=>v.id===this.data.variantId&&v.stock>0)||p.variants.find(v=>v.stock>0)||p.variants[0]||p;this.setData({product:p,selected,variantId:p.variants.length?selected.id:null,quantity:Math.min(this.data.quantity,Math.max(1,Math.min(99,selected.stock))),imageIndex:0,error:''});this.totals();")
s=s.replace('this.data.product.cashPrice','this.data.selected.cashPrice').replace('this.data.product.maxFlp','this.data.selected.maxFlp').replace('this.data.product.stock','this.data.selected.stock')
s=s.replace(' field(e)', ''' imageChanged(e){this.setData({imageIndex:e.detail.current||0});},
 previewImage(e){wx.previewImage({current:this.data.product.imageUrls[Number(e.currentTarget.dataset.index)||0],urls:this.data.product.imageUrls});},
 openCheckout(){if(!this.data.product||this.data.busy)return;const saved=api.loadAddress();if(!this.data.recipient&&!this.data.phone&&!this.data.address)this.setData(saved);this.setData({checkoutOpen:true});},
 closeCheckout(){if(this.data.busy)return;this.rememberAddress();this.setData({checkoutOpen:false});},
 stopTap(){},
 selectVariant(e){if(this.data.busy||this.orderId)return;const selected=this.data.product.variants.find(v=>v.id===e.currentTarget.dataset.id);if(!selected||selected.stock<1)return;this.setData({selected,variantId:selected.id,quantity:Math.min(this.data.quantity,selected.stock,99)});this.requestKey=null;this.totals();},
 field(e)''')
s=s.replace('this.requestKey=null;}},\n chooseAddress', 'this.requestKey=null;this.rememberAddress();}},\n chooseAddress')
s=s.replace('this.setData({address});', 'this.setData({address});this.rememberAddress();')
s=s.replace(' async submit(){if(this.data.busy||!api.login())return;', ' async submit(){if(this.data.busy||!api.login())return;if(!this.data.checkoutOpen){this.openCheckout();return;}if(!this.data.selected||this.data.selected.stock<this.data.quantity)return;')
s=s.replace(' this.setData({busy:true});',' this.rememberAddress();this.setData({busy:true});')
s=s.replace('revision:this.data.product.revision,quantity:', 'revision:this.data.product.revision,variantId:this.data.variantId,quantity:')
p.write_text(s,encoding='utf-8')
p=B/'packages/market/detail/index.wxml';s=p.read_text('utf-8')
start=s.index(' <block wx:if=');end=s.index('\n <view class="panel">',start)
s=s[:start]+''' <block wx:if="{{product}}"><view class="detail-gallery"><swiper class="product-swiper" current="{{imageIndex}}" bindchange="imageChanged" circular="{{product.imageUrls.length > 1}}"><swiper-item wx:for="{{product.imageUrls}}" wx:key="*this"><image class="gallery-image" src="{{item}}" mode="aspectFit" data-index="{{index}}" bindtap="previewImage"/></swiper-item></swiper><text class="presale" wx:if="{{product.presale}}">预售</text><view class="gallery-indicators" wx:if="{{product.imageUrls.length > 1}}"><view wx:for="{{product.imageUrls}}" wx:key="*this" class="gallery-dot {{index === imageIndex ? 'active' : ''}}"></view></view></view>'''+s[end:]
s=s.replace('优惠前 ¥','原价 ¥').replace('<text class="saving">立省 ¥{{product.flpText}}</text>','')
start=s.index(' <view class="panel"><view class="quantity-row">');end=s.index('\n <view class="buy-bar">',start)
form=s[start:end].replace('<view class="panel">','<view class="checkout-form">',1).replace('product.stock','selected.stock')
form=form.replace('<view class="quantity-row">','''<view class="checkout-product"><image src="{{product.imageUrl}}" mode="aspectFit"/><view><text class="checkout-name">{{product.title}}</text><text class="price">¥{{selected.cashText}} ＋ {{selected.flpText}} FLP</text><text class="muted" wx:if="{{selected.name}}">{{selected.name}}</text></view></view>
 <view class="variant-options" wx:if="{{product.variants.length}}"><text class="section-title">选择套餐</text><button wx:for="{{product.variants}}" wx:key="id" class="variant-option {{variantId === item.id ? 'selected' : ''}}" data-id="{{item.id}}" bindtap="selectVariant" disabled="{{busy || item.stock < 1}}"><text>{{item.name}}</text><text class="variant-price">¥{{item.cashText}} ＋ {{item.flpText}} FLP{{item.stock < 1 ? ' · 售罄' : ''}}</text></button></view><view class="quantity-row">''')
modal='''
 <view class="checkout-mask" wx:if="{{checkoutOpen}}" bindtap="closeCheckout"><view class="checkout-sheet" catchtap="stopTap"><view class="checkout-heading"><text>确认购买</text><button class="checkout-close" bindtap="closeCheckout" disabled="{{busy}}" aria-label="关闭">×</button></view><scroll-view class="checkout-scroll" scroll-y enhanced show-scrollbar="false">'''+form+'''</scroll-view><view class="checkout-footer"><view><text class="price">¥{{cashText}}</text><text class="muted">＋ {{flpText}} FLP</text></view><button class="primary" disabled="{{busy || selected.stock < quantity}}" loading="{{busy}}" bindtap="submit">{{selected.stock ? '提交订单并支付' : '暂时售罄'}}</button></view></view></view>
'''
s=s[:start]+''' <view class="panel select-summary" bindtap="openCheckout"><text>已选</text><text class="selected-label">{{selected.name || '默认规格'}} · {{quantity}} 件</text><text>›</text></view>'''+s[end:]
s=s.replace('bindtap="submit">{{product.stock ? \'提交订单并支付\' : \'暂时售罄\'}}','bindtap="openCheckout">{{product.stock ? \'选择套餐并购买\' : \'暂时售罄\'}}')
s=s.replace('</view></block>', '</view>'+modal+'</block>')
p.write_text(s,encoding='utf-8')
with (B/'packages/market/detail/index.wxss').open('a',encoding='utf-8') as f:f.write('''
.detail-gallery{position:relative;background:#fff;border-radius:14px;margin-bottom:12px;overflow:hidden}.product-swiper{height:300px}.gallery-image{width:100%;height:100%;display:block}.gallery-indicators{display:flex;justify-content:center;align-items:center;gap:5px;height:24px}.gallery-dot{width:5px;height:5px;border-radius:5px;background:#cbd7e6}.gallery-dot.active{width:20px;background:#176cf4}
.select-summary{display:flex;align-items:center;gap:12px;font-size:14px}.selected-label{flex:1;min-width:0;overflow-wrap:anywhere;color:#465464}
.checkout-mask{position:fixed;inset:0;background:rgba(12,23,38,.48);z-index:100;display:flex;align-items:flex-end;justify-content:center}.checkout-sheet{width:100%;max-width:620px;max-height:92vh;background:#fff;border-radius:20px 20px 0 0;overflow:hidden;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box}.checkout-heading{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;font-size:17px;font-weight:600;flex-shrink:0}.detail-page .checkout-close{width:32px;min-width:32px;height:32px;padding:0;line-height:32px;font-size:24px;color:#7d8998;background:#f5f7fa;border-radius:50%;margin:0}.checkout-scroll{height:58vh;min-height:0}.checkout-form{padding:0 18px 14px}.checkout-product{display:flex;align-items:center;gap:12px}.checkout-product image{width:76px;height:76px;flex-shrink:0;border-radius:8px}.checkout-product>view{min-width:0;flex:1}.checkout-name{display:block;font-size:15px;font-weight:600;line-height:22px;overflow-wrap:anywhere}.variant-options{margin-bottom:18px}.detail-page .variant-option{width:100%;margin:8px 0 0;padding:10px 12px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;border:1px solid #e5e9ef;background:#f7f8fa;color:#334352;text-align:left;font-size:14px;font-weight:400;box-sizing:border-box}.detail-page .variant-option.selected{border-color:#176cf4;background:#eff5ff;color:#176cf4}.variant-price{font-size:12px}.checkout-form .quantity-row{margin-top:18px}.checkout-footer{flex-shrink:0;display:flex;align-items:center;gap:12px;padding:12px 18px;border-top:1px solid #eef1f5}.checkout-footer>.primary{flex:1;margin:0;max-width:300px}.checkout-footer>view{min-width:90px}.checkout-scroll .footnote{display:block;padding:0 18px 18px;box-sizing:border-box}
@media(min-width:680px){.product-swiper{height:380px}.checkout-mask{align-items:center}.checkout-sheet{border-radius:20px;max-height:88vh}.checkout-scroll{height:56vh}}
''')
edit('packages/market/orders/index.wxml','{{item.title}}','{{item.title}}')
# Amount must never be squeezed or overlapped by a long product name.
with (B/'pages/profile/flp/logs/index.wxss').open('a',encoding='utf-8') as f:f.write('\n.flp-log-header{gap:12px;align-items:flex-start}.flp-log-title{flex:1;min-width:0;max-width:none;overflow-wrap:anywhere;line-height:24px}.flp-log-amount{flex-shrink:0;white-space:nowrap;line-height:24px}\n')
edit('pages/profile/flp/global/index.wxss','text-overflow: ellipsis;\n  white-space: nowrap;','white-space: normal;\n  overflow-wrap: anywhere;')
