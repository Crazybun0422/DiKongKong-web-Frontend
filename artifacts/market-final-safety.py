from pathlib import Path
p=Path('E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/market/detail/index.wxml');s=p.read_text('utf-8').replace('原价 ¥{{selected.originalText}}','优惠前 ¥{{selected.originalText}}').replace('<text class="description">','<text class="saving">立省 ¥{{selected.flpText}}</text><text class="description">');p.write_text(s,encoding='utf-8')
p=Path('E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/market/detail/index.js');s=p.read_text('utf-8').replace('p.variants.find(v=>v.stock>0)||p.variants[0]','p.variants.filter(v=>v.stock>0).sort((a,b)=>a.cashPrice-b.cashPrice)[0]||p.variants[0]');p.write_text(s,encoding='utf-8')
p=Path('E:/source_code/wechat/DiKongKong-Backend/src/main/java/com/example/dikongkongbackend/service/MarketService.java');s=p.read_text('utf-8')
old='flp.releaseMarketFlp(code,o.flp);products.lock(o.productId).ifPresent(p->{if(o.variantId!=null)changeVariantStock(p,o.variantId,o.quantity);p.stock+=o.quantity;products.save(p);});'
new='MarketProduct product=products.lock(o.productId).orElseThrow(()->bad("商品不存在"));if(o.variantId!=null)changeVariantStock(product,o.variantId,o.quantity);flp.releaseMarketFlp(code,o.flp);product.stock+=o.quantity;products.save(product);'
assert old in s;s=s.replace(old,new)
old='private ProductView view(MarketProduct p){return new ProductView'
new='''private ProductView view(MarketProduct p){
  MarketVariant selected=p.getVariants().stream().filter(v->v.stock()>0).min(Comparator.comparing(v->v.originalPrice().subtract(v.maxFlp()))).orElse(null);
  BigDecimal original=selected==null?p.originalPrice:selected.originalPrice(),points=selected==null?p.maxFlp:selected.maxFlp();
  return new ProductView'''
assert old in s;s=s.replace(old,new).replace('p.description,p.originalPrice,p.maxFlp,p.originalPrice.subtract(p.maxFlp),','p.description,original,points,original.subtract(points),');p.write_text(s,encoding='utf-8')
