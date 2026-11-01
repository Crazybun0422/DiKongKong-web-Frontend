package com.example.dikongkongbackend.service;

import com.example.dikongkongbackend.entity.*;
import com.example.dikongkongbackend.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.Path;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MarketExpiryRecoveryTest {
    @TempDir Path directory;

    @Test void restartRecoversExpiredReservationButKeepsUnexpiredOrderAndNeverReturnsTwice() throws Exception {
        String url="jdbc:h2:file:"+directory.resolve("recovery").toAbsolutePath().toString().replace('\\','/')+";MODE=MySQL;LOCK_TIMEOUT=10000";
        String expired;
        long productId;
        try (var app=new App(url)) {
            productId=app.seed();
            expired=app.service.create("ABC123",checkout(productId,"request_expired_01")).id;
            app.service.create("ABC123",checkout(productId,"request_current_02"));
            app.tx.executeWithoutResult(s->app.orders.lock(expired).orElseThrow().createdAt=Instant.now().minusSeconds(1900));
            app.assertState("6.00",0);
        }
        // Recreate the persistence factory and every service with the same on-disk database.
        try (var app=new App(url)) {
            app.expiry.expire();
            app.assertState("8.00",1);
            assertEquals("CANCELLED",app.orders.findById(expired).orElseThrow().status);
            assertEquals(1,app.orders.findAll().stream().filter(o->o.status.equals("WAITING_PAYMENT")).count());
            app.expiry.expire();
            app.assertState("8.00",1);
            var recent=app.orders.findAll().stream().filter(o->o.status.equals("WAITING_PAYMENT")).findFirst().orElseThrow();
            app.tx.executeWithoutResult(s->app.orders.lock(recent.id).orElseThrow().createdAt=Instant.now().minusSeconds(1900));
            ExecutorService pool=Executors.newFixedThreadPool(2);
            try {
                var gate=new CountDownLatch(1);
                var a=pool.submit(()->{gate.await();new MarketExpiryService(app.orders,app.service).expire();return true;});
                var b=pool.submit(()->{gate.await();app.service.cancel("ABC123",recent.id);return true;});
                gate.countDown(); a.get(15,TimeUnit.SECONDS); b.get(15,TimeUnit.SECONDS);
            } finally {pool.shutdownNow();}
            app.assertState("10.00",2);
            assertEquals(2,app.audits.findAll().stream().filter(a->a.action.equals("ORDER_CANCEL")).count());
        }
        try (var app=new App(url)) {app.expiry.expire();app.assertState("10.00",2);}
    }

    @Test void failureAfterBalanceAndStockChangesRollsBackAndNextScanRecovers() {
        String url="jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (var app=new App(url)) {
            long id=app.seed();
            String order=app.service.create("ABC123",checkout(id,"request_rollback_01")).id;
            app.tx.executeWithoutResult(s->app.orders.lock(order).orElseThrow().createdAt=Instant.now().minusSeconds(1900));
            doThrow(new IllegalStateException("simulated failure before commit")).when(app.audits).save(argThat(a->a!=null&&a.action.equals("ORDER_CANCEL")));
            app.expiry.expire();
            app.assertState("8.00",1);
            assertEquals("WAITING_PAYMENT",app.orders.findById(order).orElseThrow().status);
            reset(app.audits);
            // Restore delegation after removing the injected failure.
            when(app.audits.save(any(MarketAudit.class))).thenAnswer(a->app.realAudits.save(a.getArgument(0)));
            app.expiry.expire();
            app.assertState("10.00",2);
        }
    }

    static MarketService.Checkout checkout(long id,String key) {
        return new MarketService.Checkout(id,0,1,key,"飞友","13800138000","测试地址","standard");
    }

    static class App implements AutoCloseable {
        final LocalContainerEntityManagerFactoryBean factory=new LocalContainerEntityManagerFactoryBean();
        final EntityManager em;
        final JpaTransactionManager tm;
        final TransactionTemplate tx;
        final MarketProductRepository products;
        final MarketOrderRepository orders;
        final MarketAuditRepository audits,realAudits;
        final FlpBalanceRepository balances;
        final MarketService service;
        final MarketExpiryService expiry;
        App(String url) {
            var ds=new DriverManagerDataSource(url,"sa","");
            factory.setDataSource(ds);factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setManagedTypes(PersistenceManagedTypes.of(MarketProduct.class.getName(),MarketOrder.class.getName(),MarketAudit.class.getName(),FlpBalance.class.getName()));
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto","update"));factory.afterPropertiesSet();
            var emf=factory.getObject();em=SharedEntityManagerCreator.createSharedEntityManager(emf);
            tm=new JpaTransactionManager(emf);tm.setDataSource(ds);tx=new TransactionTemplate(tm);
            var repos=new JpaRepositoryFactory(em);
            products=repos.getRepository(MarketProductRepository.class);orders=repos.getRepository(MarketOrderRepository.class);
            realAudits=repos.getRepository(MarketAuditRepository.class);
            audits=mock(MarketAuditRepository.class,org.mockito.AdditionalAnswers.delegatesTo(realAudits));
            balances=repos.getRepository(FlpBalanceRepository.class);
            var users=mock(UserRepository.class);
            when(users.lockCurrentStatus(anyString())).thenAnswer(a->{balances.findCurrentBalanceForUpdate(a.getArgument(0)).orElseThrow();return "ACTIVE";});
            var flp=transactional(new FlpService(users,balances,mock(FlpLogRepository.class),mock(FlpTotalCounterRepository.class),mock(FlpPoolConfigService.class),mock(FlpRealtimeService.class),mock(OrderService.class),mock(OrderPaymentStatusUpdater.class)));
            var numbers=mock(OrderNumberService.class);
            when(numbers.next()).thenAnswer(a->"LLP"+UUID.randomUUID().toString().replace("-","").substring(0,29));
            service=transactional(new MarketService(products,orders,audits,users,flp,mock(WechatPaymentService.class),mock(OrderRepository.class),numbers));
            expiry=new MarketExpiryService(orders,service);
        }
        @SuppressWarnings("unchecked") <T> T transactional(T target) {
            var advice=new TransactionInterceptor();advice.setTransactionManager(tm);advice.setTransactionAttributeSource(new AnnotationTransactionAttributeSource());
            var proxy=new ProxyFactory(target);proxy.setProxyTargetClass(true);proxy.addAdvice(advice);return (T)proxy.getProxy();
        }
        long seed() {
            return tx.execute(s->{
                var balance=new FlpBalance();balance.setFeatureCode("ABC123");balance.setBalance(new BigDecimal("10.00"));balances.save(balance);
                var p=new MarketProduct();p.title="fixture";p.imageUrl="item.png";p.originalPrice=new BigDecimal("10.00");p.maxFlp=new BigDecimal("2.00");p.costPrice=new BigDecimal("7.00");p.stock=2;p.published=true;p.supplier="supplier";p.createdAt=p.updatedAt=Instant.now();
                p.setVariants(List.of(new MarketVariant("standard","标准版",p.originalPrice,p.maxFlp,p.costPrice,2)));
                products.saveAndFlush(p);return p.id;
            });
        }
        void assertState(String balance,int stock) {
            tx.executeWithoutResult(s->{
                assertEquals(new BigDecimal(balance),balances.findByFeatureCode("ABC123").orElseThrow().getBalance());
                var product=products.findAll().get(0);assertEquals(stock,product.stock);assertEquals(stock,product.getVariants().get(0).stock());
            });
        }
        public void close() {factory.destroy();}
    }
}

