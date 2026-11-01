from pathlib import Path
B=Path('E:/source_code/wechat/DiKongKong-Backend/src/main/java/com/example/dikongkongbackend')
def edit(path,old,new):
 p=B/path; s=p.read_text('utf-8'); assert old in s,(path,old[:90]); p.write_text(s.replace(old,new),encoding='utf-8')
(B/'entity/MarketVariant.java').write_text('''package com.example.dikongkongbackend.entity;
import java.math.BigDecimal;
public record MarketVariant(String id,String name,BigDecimal originalPrice,BigDecimal maxFlp,BigDecimal costPrice,int stock) {}
''',encoding='utf-8')
edit('entity/MarketProduct.java',' public boolean published;',''' @com.fasterxml.jackson.annotation.JsonIgnore @Column(columnDefinition="TEXT") public String imageUrlsJson;
 @com.fasterxml.jackson.annotation.JsonIgnore @Column(columnDefinition="TEXT") public String variantsJson;
 private static final com.fasterxml.jackson.databind.ObjectMapper JSON=new com.fasterxml.jackson.databind.ObjectMapper();
 public java.util.List<String> getImageUrls(){return read(imageUrlsJson,new com.fasterxml.jackson.core.type.TypeReference<java.util.List<String>>(){});}
 public void setImageUrls(java.util.List<String> value){imageUrlsJson=write(value);}
 public java.util.List<MarketVariant> getVariants(){return read(variantsJson,new com.fasterxml.jackson.core.type.TypeReference<java.util.List<MarketVariant>>(){});}
 public void setVariants(java.util.List<MarketVariant> value){variantsJson=write(value);}
 private static <T> java.util.List<T> read(String value,com.fasterxml.jackson.core.type.TypeReference<java.util.List<T>> type){try{return value==null||value.isBlank()?java.util.List.of():JSON.readValue(value,type);}catch(java.io.IOException e){throw new IllegalStateException("Invalid market product data",e);}}
 private static String write(Object value){try{return JSON.writeValueAsString(value);}catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}}
 public boolean published;''')
edit('entity/MarketOrder.java',' public int quantity;',' @Column(length=40) public String variantId;\n @Column(length=80) public String variantName;\n public int quantity;')
edit('repository/MarketOrderRepository.java',' List<MarketOrder> findTop50',' List<MarketOrder> findByProductIdAndStatus(Long productId,String status);\n List<MarketOrder> findTop50')
edit('service/MarketService.java','String brand,String category){}\n public record Checkout(long productId,long revision,int quantity,String requestKey,String recipient,String phone,String address){}','''String brand,String category,List<String> imageUrls,List<MarketVariant> variants){
  public ProductDraft(String title,String imageUrl,String description,BigDecimal originalPrice,BigDecimal maxFlp,BigDecimal costPrice,String supplier,boolean published,boolean presale,int stock,Long revision,String brand,String category){this(title,imageUrl,description,originalPrice,maxFlp,costPrice,supplier,published,presale,stock,revision,brand,category,null,null);}
 }
 public record Checkout(long productId,long revision,int quantity,String requestKey,String recipient,String phone,String address,String variantId){
  public Checkout(long productId,long revision,int quantity,String requestKey,String recipient,String phone,String address){this(productId,revision,quantity,requestKey,recipient,phone,address,null);}
 }
 public record VariantView(String id,String name,BigDecimal originalPrice,BigDecimal maxFlp,BigDecimal cashPrice,int stock){}''')
edit('service/MarketService.java','int stock,String brand,String category){}','int stock,String brand,String category,List<String> imageUrls,List<VariantView> variants){}')
edit('service/MarketService.java','p.presale,p.stock,p.brand,p.category);','p.presale,p.stock,p.brand,p.category,p.getImageUrls().isEmpty()?List.of(p.imageUrl):p.getImageUrls(),p.getVariants().stream().map(v->new VariantView(v.id(),v.name(),v.originalPrice(),v.maxFlp(),v.originalPrice().subtract(v.maxFlp()),v.stock())).toList());')
edit('service/MarketService.java','if(d==null)throw bad("请填写商品信息");cash(d.originalPrice,d.maxFlp,d.costPrice);','if(d==null)throw bad("请填写商品信息");')
edit('service/MarketService.java','p.offerVersion++;products.saveAndFlush(p);','''configureOptions(p,d);
  p.offerVersion++;products.saveAndFlush(p);''')
needle=' private void lockUser(String code)'
extra=''' private void configureOptions(MarketProduct p,ProductDraft d){
  List<String> images=d.imageUrls==null?(p.getImageUrls().isEmpty()?List.of(p.imageUrl):p.getImageUrls()):d.imageUrls;
  if(images.isEmpty()||images.size()>9)throw bad("请上传 1 至 9 张商品图片");
  p.setImageUrls(images.stream().map(x->text(x,2000,"商品图片")).distinct().toList());p.imageUrl=p.getImageUrls().get(0);
  List<MarketVariant> old=p.getVariants(), variants=d.variants==null?old:d.variants;
  if(variants.size()>30)throw bad("最多配置 30 个套餐");
  Set<String> ids=new HashSet<>(),names=new HashSet<>();List<MarketVariant> normalized=new ArrayList<>();
  for(MarketVariant v:variants){
   if(v==null)throw bad("套餐填写不正确");String id=optionalText(v.id(),40,"套餐标识");
   if(id.isEmpty())id=UUID.randomUUID().toString();else if(!id.matches("[a-zA-Z0-9_-]{1,40}"))throw bad("套餐标识不正确");
   String name=text(v.name(),80,"套餐名称");if(!ids.add(id)||!names.add(name))throw bad("套餐标识或名称重复");
   cash(v.originalPrice(),v.maxFlp(),v.costPrice());if(v.stock()<0||v.stock()>1000000)throw bad("套餐可售数量不正确");
   normalized.add(new MarketVariant(id,name,money(v.originalPrice(),"原价"),money(v.maxFlp(),"FLP"),money(v.costPrice(),"成本价"),v.stock()));
  }
  if(p.id!=null){for(MarketOrder order:orders.findByProductIdAndStatus(p.id,"WAITING_PAYMENT")){
   if((order.variantId==null&&!normalized.isEmpty())||(order.variantId!=null&&!ids.contains(order.variantId)))throw bad("存在待支付订单，请保留对应套餐，或待订单结束后切换规格模式");
  }}
  p.setVariants(normalized);
  if(normalized.isEmpty())cash(p.originalPrice,p.maxFlp,p.costPrice);
  else {MarketVariant lowest=normalized.stream().filter(v->v.stock()>0).min(Comparator.comparing(v->v.originalPrice().subtract(v.maxFlp()))).orElseGet(()->normalized.stream().min(Comparator.comparing(v->v.originalPrice().subtract(v.maxFlp()))).orElseThrow());
   p.originalPrice=lowest.originalPrice();p.maxFlp=lowest.maxFlp();p.costPrice=lowest.costPrice();p.stock=normalized.stream().mapToInt(MarketVariant::stock).sum();
  }
 }
 private void changeVariantStock(MarketProduct p,String id,int delta){
  List<MarketVariant> changed=new ArrayList<>();boolean found=false;
  for(MarketVariant v:p.getVariants()){if(v.id().equals(id)){found=true;if(v.stock()+delta<0)throw bad("套餐可售数量不足");changed.add(new MarketVariant(v.id(),v.name(),v.originalPrice(),v.maxFlp(),v.costPrice(),v.stock()+delta));}else changed.add(v);}
  if(!found)throw bad("套餐不存在");p.setVariants(changed);
 }
'''
edit('service/MarketService.java',needle,extra+needle)
edit('service/MarketService.java','if(o.productId!=d.productId||o.quantity!=d.quantity||','if(o.productId!=d.productId||o.quantity!=d.quantity||!Objects.equals(o.variantId,d.variantId)||')
edit('service/MarketService.java','  MarketOrder o=new MarketOrder();o.id=orderNumbers.next();','''  MarketVariant variant=null;
  if(!p.getVariants().isEmpty()){variant=p.getVariants().stream().filter(v->Objects.equals(v.id(),d.variantId)).findFirst().orElseThrow(()->bad("请选择套餐"));if(variant.stock()<d.quantity)throw bad("套餐可售数量不足");}
  else if(d.variantId!=null&&!d.variantId.isBlank())throw bad("套餐不存在");
  MarketOrder o=new MarketOrder();o.id=orderNumbers.next();''')
edit('service/MarketService.java','  o.cash=cash(p.originalPrice,p.maxFlp,p.costPrice).multiply(n);o.flp=p.maxFlp.multiply(n);o.cost=p.costPrice.multiply(n);','''  BigDecimal original=variant==null?p.originalPrice:variant.originalPrice(),points=variant==null?p.maxFlp:variant.maxFlp(),cost=variant==null?p.costPrice:variant.costPrice();
  o.variantId=variant==null?null:variant.id();o.variantName=variant==null?null:variant.name();
  o.cash=cash(original,points,cost).multiply(n);o.flp=points.multiply(n);o.cost=cost.multiply(n);''')
edit('service/MarketService.java','flp.reserveMarketFlp(code,o.flp);p.stock-=d.quantity;','flp.reserveMarketFlp(code,o.flp);if(variant!=null)changeVariantStock(p,variant.id(),-d.quantity);p.stock-=d.quantity;')
edit('service/MarketService.java','flp.consumeReservedMarketFlp(o.featureCode,o.flp,o.id);','flp.consumeReservedMarketFlp(o.featureCode,o.flp,o.id,o.title+(o.variantName==null?"":" · "+o.variantName));')
edit('service/MarketService.java','p.stock+=o.quantity;products.save(p);','if(o.variantId!=null)changeVariantStock(p,o.variantId,o.quantity);p.stock+=o.quantity;products.save(p);')
edit('service/MarketService.java','m.put("title",o.title);','m.put("title",o.title);m.put("variantId",o.variantId);m.put("variantName",o.variantName);')
edit('service/MarketService.java','订单号,商品,数量,供应商','订单号,商品,套餐,数量,供应商')
edit('service/MarketService.java','Stream.of(o.id,o.title,o.quantity','Stream.of(o.id,o.title,o.variantName,o.quantity')
# Preserve the legacy entry point while new paid orders log their immutable name snapshot.
edit('service/FlpService.java','        lockAccountForBalanceChange(code);\n        updateTotalCounter(getOrCreateCounterForUpdate(DESTROYED_COUNTER_KEY,OPERATION_DECREASE),amount);','''        consumeReservedMarketFlp(code,amount,orderId,null);
    }
    @Transactional
    public void consumeReservedMarketFlp(String code, BigDecimal amount, String orderId, String productTitle) {
        lockAccountForBalanceChange(code);
        updateTotalCounter(getOrCreateCounterForUpdate(DESTROYED_COUNTER_KEY,OPERATION_DECREASE),amount);''')
edit('service/FlpService.java','log.setReason("星球有市订单 "+orderId);','log.setReason(productTitle==null?"星球有市订单 "+orderId:"星球有市 · "+productTitle);')
