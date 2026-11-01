from pathlib import Path
T=Path('E:/source_code/wechat/DiKongKong-Backend/src/test/java/com/example/dikongkongbackend/service')
p=T/'MarketServiceTest.java';s=p.read_text('utf-8').replace('v.productId=1L;v.featureCode=', 'v.productId=1L;v.title="飞行好物";v.featureCode=');p.write_text(s,encoding='utf-8')
(T/'MarketVariantTest.java').write_text('''package com.example.dikongkongbackend.service;
import com.example.dikongkongbackend.entity.*;
import com.example.dikongkongbackend.repository.*;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class MarketVariantTest {
 MarketProductRepository products=mock(MarketProductRepository.class);MarketOrderRepository orders=mock(MarketOrderRepository.class);FlpService flp=mock(FlpService.class);UserRepository users=mock(UserRepository.class);
 MarketService service=new MarketService(products,orders,mock(MarketAuditRepository.class),users,flp,mock(WechatPaymentService.class),mock(OrderRepository.class),mock(OrderNumberService.class));
 MarketProduct product;
 BigDecimal money(String s){return new BigDecimal(s);}
 MarketVariant variant(String id,int stock){return new MarketVariant(id,id,money("20.00"),money("3.00"),money("10.00"),stock);}
 @BeforeEach void setup(){when(users.lockCurrentStatus("ABC123")).thenReturn("ACTIVE");product=new MarketProduct();product.id=1L;product.title="飞行套装";product.imageUrl="cover.png";product.setImageUrls(List.of("cover.png","second.png"));product.setVariants(List.of(variant("standard",2),variant("extra",1)));product.stock=3;product.originalPrice=money("20.00");product.maxFlp=money("3.00");product.costPrice=money("10.00");product.published=true;product.supplier="商家";when(products.lock(1L)).thenReturn(Optional.of(product));when(products.findById(1L)).thenReturn(Optional.of(product));}
 MarketService.Checkout checkout(String id,int n){return new MarketService.Checkout(1,0,n,"request_key_123456","飞友","13800138000","测试地址",id);}
 MarketService.ProductDraft draft(List<MarketVariant> variants){return new MarketService.ProductDraft(product.title,"cover.png","",null,null,null,"商家",true,false,0,0L,"品牌","配件",List.of("cover.png","second.png"),variants);}
 @Test void selectedVariantPricesAndStockAreAuthoritative(){var o=service.create("ABC123",checkout("standard",2));assertEquals(money("34.00"),o.cash);assertEquals(money("6.00"),o.flp);assertEquals("standard",o.variantName);assertEquals(0,product.getVariants().get(0).stock());assertEquals(1,product.getVariants().get(1).stock());assertEquals(1,product.stock);verify(flp).reserveMarketFlp("ABC123",money("6.00"));}
 @Test void unknownOrSoldOutVariantCannotBorrowOtherStock(){assertThrows(RuntimeException.class,()->service.create("ABC123",checkout(null,1)));assertThrows(RuntimeException.class,()->service.create("ABC123",checkout("missing",1)));assertThrows(RuntimeException.class,()->service.create("ABC123",checkout("extra",2)));verifyNoInteractions(flp);}
 @Test void cancelReturnsOnlySelectedStockOnce(){var o=service.create("ABC123",checkout("extra",1));when(orders.lock(o.id)).thenReturn(Optional.of(o));service.cancel("ABC123",o.id);service.cancel("ABC123",o.id);assertEquals(2,product.getVariants().get(0).stock());assertEquals(1,product.getVariants().get(1).stock());assertEquals(3,product.stock);verify(flp,times(1)).releaseMarketFlp("ABC123",money("3.00"));}
 @Test void retryCannotChangeVariant(){var o=service.create("ABC123",checkout("extra",1));when(orders.findByFeatureCodeAndRequestKey("ABC123",o.requestKey)).thenReturn(Optional.of(o));assertSame(o,service.create("ABC123",checkout("extra",1)));assertThrows(RuntimeException.class,()->service.create("ABC123",checkout("standard",1)));}
 @Test void publicViewKeepsGalleryAndNeverExposesCost(){var view=service.product(1);assertEquals(2,view.imageUrls().size());assertEquals(money("17.00"),view.variants().get(0).cashPrice());assertFalse(Arrays.stream(MarketService.VariantView.class.getRecordComponents()).anyMatch(c->c.getName().equals("costPrice")));}
 @Test void galleryAndVariantValidationAndPendingProtection(){var invalid=new MarketVariant("bad","bad",money("10"),money("2"),money("8"),1);assertThrows(RuntimeException.class,()->service.save(1L,draft(List.of(invalid)),"admin"));MarketOrder pending=new MarketOrder();pending.variantId="extra";when(orders.findByProductIdAndStatus(1L,"WAITING_PAYMENT")).thenReturn(List.of(pending));assertThrows(RuntimeException.class,()->service.save(1L,draft(List.of(variant("standard",2))),"admin"));}
 @Test void saveKeepsDifferentPricesAndIndependentStock(){var low=new MarketVariant("basic","基础套装",money("10.00"),money("2.00"),money("5.00"),2);var saved=service.save(1L,draft(List.of(low,variant("extra",3))),"admin");assertEquals(5,saved.stock);assertEquals(money("10.00"),saved.originalPrice);assertEquals(2,saved.getImageUrls().size());assertEquals(money("20.00"),saved.getVariants().get(1).originalPrice());}
}
''',encoding='utf-8')
p=T/'MarketConcurrencyTest.java';s=p.read_text('utf-8');needle='  } finally {pool.shutdownNow();factory.destroy();}'
assert needle in s;s=s.replace(needle,'''   // The same pessimistic product lock protects persisted per-variant inventory.
   tx.executeWithoutResult(t->{MarketProduct p=products.lock(id).orElseThrow();p.setVariants(List.of(new MarketVariant("last","最后一件",new BigDecimal("10.00"),new BigDecimal("2.00"),new BigDecimal("7.00"),1),new MarketVariant("other","其他套餐",new BigDecimal("20.00"),new BigDecimal("2.00"),new BigDecimal("8.00"),5)));p.stock=6;em.createNativeQuery("update wallet set balance=10").executeUpdate();});
   CountDownLatch variantGate=new CountDownLatch(1);
   var variantA=pool.submit(()->variantAttempt(service,variantGate,"ABC123",id,"variant_key_abc123"));var variantB=pool.submit(()->variantAttempt(service,variantGate,"DEF456",id,"variant_key_def456"));variantGate.countDown();
   assertEquals(1,(variantA.get(15,TimeUnit.SECONDS)?1:0)+(variantB.get(15,TimeUnit.SECONDS)?1:0));
   tx.executeWithoutResult(t->{var p=products.findById(id).orElseThrow();assertEquals(0,p.getVariants().get(0).stock());assertEquals(5,p.getVariants().get(1).stock());assertEquals(5,p.stock);assertEquals(2,orders.count());assertEquals(new BigDecimal("18.00"),em.createNativeQuery("select sum(balance) from wallet").getSingleResult());});
''' +needle)
needle=' private boolean attempt('
s=s.replace(needle,''' private boolean variantAttempt(MarketService s,CountDownLatch gate,String code,long id,String key)throws Exception{gate.await();try{s.create(code,new MarketService.Checkout(id,0,1,key,"飞友","13800138000","测试地址","last"));return true;}catch(org.springframework.web.server.ResponseStatusException e){return false;}}
''' +needle);p.write_text(s,encoding='utf-8')
(T/'MarketFlpNamesTest.java').write_text('''package com.example.dikongkongbackend.service;
import com.example.dikongkongbackend.entity.*;
import com.example.dikongkongbackend.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class MarketFlpNamesTest {
 @Test void personalAndGlobalHistoryResolveOrderNameWithoutMutatingAuditLog(){
  var logs=mock(FlpLogRepository.class);var orders=mock(MarketOrderRepository.class);
  var service=new FlpService(mock(UserRepository.class),mock(FlpBalanceRepository.class),logs,mock(FlpTotalCounterRepository.class),mock(FlpPoolConfigService.class),mock(FlpRealtimeService.class),mock(OrderService.class),mock(OrderPaymentStatusUpdater.class),orders);
  var log=new FlpLog();log.setFeatureCode("ABC123");log.setReason("星球有市订单 old-id");var order=new MarketOrder();order.id="old-id";order.featureCode="ABC123";order.title="收纳包";order.variantName="双电池";
  when(orders.findAllById(List.of("old-id"))).thenReturn(List.of(order));var page=PageRequest.of(0,20);when(logs.findAll(page)).thenReturn(new PageImpl<>(List.of(log)));when(logs.findByFeatureCodeOrderByCreatedAtDesc("ABC123",page)).thenReturn(new PageImpl<>(List.of(log)));
  assertEquals("星球有市 · 收纳包 · 双电池",service.getLogs(Optional.empty(),page).getContent().get(0).getReason());assertEquals("星球有市 · 收纳包 · 双电池",service.getLogs(Optional.of("ABC123"),page).getContent().get(0).getReason());assertEquals("星球有市订单 old-id",log.getReason());
 }
}
''',encoding='utf-8')
