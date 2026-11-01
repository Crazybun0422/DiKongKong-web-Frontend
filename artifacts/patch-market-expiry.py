from pathlib import Path
root = Path('E:/source_code/wechat/DiKongKong-Backend')
stage = Path('E:/source_code/wechat/DiKongKong-web-Frontend/artifacts')
base = root / 'src/main/java/com/example/dikongkongbackend'
(base / 'service/MarketExpiryService.java').write_bytes((stage / 'MarketExpiryService.java').read_bytes())
repo = base / 'repository/MarketOrderRepository.java'
content = repo.read_text(encoding='utf-8')
old = ' List<MarketOrder> findTop50ByStatusAndCreatedAtBeforeOrderByCreatedAtAsc(String status,Instant before);'
new = ''' @Query("select o from MarketOrder o where o.status='WAITING_PAYMENT' and o.createdAt<:before and o.id>:afterId order by o.id asc")
 List<MarketOrder> findExpiredBatch(@Param("before") Instant before, @Param("afterId") String afterId, org.springframework.data.domain.Pageable pageable);'''
assert old in content
repo.write_text(content.replace(old,new),encoding='utf-8')
for name in ['MarketExpiryRecoveryTest.java','MarketExpiryServiceTest.java']:
    (root/'src/test/java/com/example/dikongkongbackend/service'/name).write_bytes((stage/name).read_bytes())
