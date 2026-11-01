from pathlib import Path
B=Path('E:/source_code/wechat/DiKongKong-Backend/src/main/java/com/example/dikongkongbackend')
p=B/'service/FlpService.java';s=p.read_text('utf-8');pos=s.index('    @EventListener(ApplicationReadyEvent.class)')
s=s[:pos]+'''    private com.example.dikongkongbackend.repository.MarketOrderRepository marketOrders;
    @org.springframework.beans.factory.annotation.Autowired
    public FlpService(UserRepository users,FlpBalanceRepository balances,FlpLogRepository logs,FlpTotalCounterRepository totals,FlpPoolConfigService config,FlpRealtimeService realtime,OrderService orders,OrderPaymentStatusUpdater updater,com.example.dikongkongbackend.repository.MarketOrderRepository marketOrders){
        this(users,balances,logs,totals,config,realtime,orders,updater);this.marketOrders=marketOrders;
    }

'''+s[pos:]
needle='    public Page<FlpLog> getLogs(Optional<String> featureCode, Optional<FlpLogType> logType, Pageable pageable) {'
s=s.replace(needle,'''    public Page<FlpLog> getLogs(Optional<String> featureCode, Optional<FlpLogType> logType, Pageable pageable) {
        Page<FlpLog> page=queryLogs(featureCode,logType,pageable);
        if(marketOrders==null)return page;
        String prefix="星球有市订单 ";
        var ids=page.stream().map(FlpLog::getReason).filter(r->r!=null&&r.startsWith(prefix)).map(r->r.substring(prefix.length())).distinct().toList();
        if(ids.isEmpty())return page;
        var names=marketOrders.findAllById(ids).stream().collect(Collectors.toMap(o->o.id,Function.identity()));
        return page.map(log->{
            String reason=log.getReason();if(reason==null||!reason.startsWith(prefix))return log;
            var order=names.get(reason.substring(prefix.length()));
            if(order==null||!java.util.Objects.equals(order.featureCode,log.getFeatureCode()))return log;
            FlpLog copy=new FlpLog();org.springframework.beans.BeanUtils.copyProperties(log,copy);
            copy.setReason("星球有市 · "+order.title+(order.variantName==null?"":" · "+order.variantName));return copy;
        });
    }
    private Page<FlpLog> queryLogs(Optional<String> featureCode, Optional<FlpLogType> logType, Pageable pageable) {''')
p.write_text(s,encoding='utf-8')
p=B/'service/MarketService.java';s=p.read_text('utf-8');s=s.replace('p.originalPrice=money(d.originalPrice,"原价");p.maxFlp=money(d.maxFlp,"FLP");p.costPrice=money(d.costPrice,"成本价");','if(d.variants==null||d.variants.isEmpty()){p.originalPrice=money(d.originalPrice,"原价");p.maxFlp=money(d.maxFlp,"FLP");p.costPrice=money(d.costPrice,"成本价");}')
p.write_text(s,encoding='utf-8')
p=B.parent.parent.parent.parent/'test/java/com/example/dikongkongbackend/service/MarketServiceTest.java'
# Explicit test path keeps existing payment assertions aligned with name snapshots.
p=Path('E:/source_code/wechat/DiKongKong-Backend/src/test/java/com/example/dikongkongbackend/service/MarketServiceTest.java');s=p.read_text('utf-8').replace('consumeReservedMarketFlp("ABC123",v.flp,v.id);','consumeReservedMarketFlp("ABC123",v.flp,v.id,v.title);');p.write_text(s,encoding='utf-8')
p=Path('E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/market/orders/index.wxml');s=p.read_text('utf-8').replace('<text class="muted">{{item.presale', '<text class="muted" wx:if="{{item.variantName}}">{{item.variantName}}</text><text class="muted">{{item.presale');p.write_text(s,encoding='utf-8')
