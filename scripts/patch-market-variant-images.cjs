const fs=require('fs'),path=require('path');
function edit(file,fn){const s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');fs.writeFileSync(file,fn(s));}
function rep(s,a,b){if(!s.includes(a))throw Error(a);return s.replace(a,b);}
const backend='E:/source_code/wechat/DiKongKong-Backend/src/main/java/com/example/dikongkongbackend';
edit(backend+'/entity/MarketVariant.java',s=>rep(s,'int stock) {}',`int stock,String imageUrl) {
 public MarketVariant(String id,String name,BigDecimal originalPrice,BigDecimal maxFlp,BigDecimal costPrice,int stock){this(id,name,originalPrice,maxFlp,costPrice,stock,null);}
}`));
edit(backend+'/service/MarketService.java',s=>{
 s=rep(s,'BigDecimal cashPrice,int stock){}','BigDecimal cashPrice,int stock,String imageUrl){}');
 s=rep(s,'v.originalPrice().subtract(v.maxFlp()),v.stock())).toList()', 'v.originalPrice().subtract(v.maxFlp()),v.stock(),v.imageUrl())).toList()');
 s=rep(s,'money(v.costPrice(),"成本价"),v.stock()))','money(v.costPrice(),"成本价"),v.stock(),optionalText(v.imageUrl(),2000,"规格图")))');
 s=rep(s,'v.costPrice(),v.stock()+delta))','v.costPrice(),v.stock()+delta,v.imageUrl()))');
 s=rep(s,'o.title=p.title;o.imageUrl=p.imageUrl;', 'o.title=p.title;o.imageUrl=variant!=null&&variant.imageUrl()!=null&&!variant.imageUrl().isBlank()?variant.imageUrl():p.imageUrl;');
 return s;
});
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/market/';
edit(mini+'api.js',s=>rep(s,'variants:(p.variants||[]).map(price)','variants:(p.variants||[]).map(v=>({...price(v),imageUrl:imageSrc(v.imageUrl)||imageSrc(p.imageUrl)}))'));
edit(mini+'detail/index.wxml',s=>{
 s=rep(s,'<image src="{{product.imageUrl}}" mode="aspectFit"/>','<image src="{{selected.imageUrl || product.imageUrl}}" mode="aspectFit" bindtap="previewVariantImage"/>');
 return rep(s,'提交订单后锁定 FLP，30 分钟内完成支付；未支付取消或超时后返还。','提交后FLP将锁定，30分钟内未支付会释放。');
});
edit(mini+'detail/index.js',s=>rep(s,' openCheckout(){',` previewVariantImage(){const image=this.data.selected?.imageUrl||this.data.product?.imageUrl;if(image)wx.previewImage({current:image,urls:[image]});},
 openCheckout(){`));
edit(mini+'orders/index.wxml',s=>rep(s,'class="small outline" disabled="{{busy}}" data-id="{{item.id}}" data-action="cancel"','class="small outline cancel-order" disabled="{{busy}}" data-id="{{item.id}}" data-action="cancel"'));
edit(mini+'orders/index.wxss',s=>s+`\n/* Keep cancellation secondary and compact on both phone and desktop. */
.actions .cancel-order{flex:0 0 88px;width:88px;min-width:88px;max-width:88px;box-sizing:border-box;padding:9px 8px;white-space:nowrap;margin:0}
`);
console.log('Updated backend variant image persistence/order snapshot and mini checkout/order UI.');
