const fs=require('fs');
const file='E:/source_code/wechat/DiKongKong-Backend/src/test/java/com/example/dikongkongbackend/service/MarketVariantTest.java';let s=fs.readFileSync(file,'utf8');
s=s.slice(0,s.lastIndexOf('}'))+`
 @Test void variantImagePersistsInJsonAndPublicView(){
  var pictured=new MarketVariant("standard","标准套装",money("20"),money("3"),money("10"),2,"standard.png");
  service.save(1L,draft(List.of(pictured,variant("extra",1))),"admin");
  assertEquals("standard.png",product.getVariants().get(0).imageUrl());
  assertEquals("standard.png",service.product(1).variants().get(0).imageUrl());
  assertEquals("",service.product(1).variants().get(1).imageUrl());
 }
 @Test void checkoutSnapshotsSelectedImageAndStockChangesKeepIt(){
  product.setVariants(List.of(new MarketVariant("standard","标准套装",money("20"),money("3"),money("10"),2,"standard.png"),variant("extra",1)));
  var order=service.create("ABC123",checkout("standard",1));
  assertEquals("standard.png",order.imageUrl);assertEquals("standard.png",product.getVariants().get(0).imageUrl());
  when(orders.lock(order.id)).thenReturn(Optional.of(order));service.cancel("ABC123",order.id);
  assertEquals("standard.png",product.getVariants().get(0).imageUrl());
  product.setVariants(List.of(new MarketVariant("standard","标准套装",money("20"),money("3"),money("10"),2,"changed.png")));
  assertEquals("standard.png",service.customerOrder(order).get("imageUrl"));
 }
 @Test void legacyJsonWithoutImageStillLoadsAndUsesCover(){
  product.variantsJson="[{\\"id\\":\\"standard\\",\\"name\\":\\"standard\\",\\"originalPrice\\":20,\\"maxFlp\\":3,\\"costPrice\\":10,\\"stock\\":2}]";
  assertNull(product.getVariants().get(0).imageUrl());
  assertEquals("cover.png",service.create("ABC123",checkout("standard",1)).imageUrl);
 }
 @Test void tooLongVariantImageRejected(){
  var invalid=new MarketVariant("standard","standard",money("20"),money("3"),money("10"),2,"x".repeat(2001));
  assertThrows(RuntimeException.class,()->service.save(1L,draft(List.of(invalid)),"admin"));
 }
}
`;
fs.writeFileSync(file,s);
