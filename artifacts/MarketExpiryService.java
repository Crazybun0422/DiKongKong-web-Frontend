package com.example.dikongkongbackend.service;

import com.example.dikongkongbackend.repository.MarketOrderRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class MarketExpiryService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MarketExpiryService.class);
    private final MarketOrderRepository orders;
    private final MarketService market;
    private final AtomicBoolean running = new AtomicBoolean();

    public MarketExpiryService(MarketOrderRepository orders, MarketService market) {
        this.orders = orders;
        this.market = market;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(fixedDelay = 60000)
    public void expire() {
        if (!running.compareAndSet(false, true)) return;
        try {
            // The database is the durable queue. A restart never resets the payment deadline.
            Instant cutoff = Instant.now().minusSeconds(1800);
            String afterId = "";
            while (true) {
                var batch = orders.findExpiredBatch(cutoff, afterId, PageRequest.of(0, 50));
                if (batch.isEmpty()) return;
                for (var order : batch) {
                    try {
                        // Each order has its own transaction and row locks, including FLP and stock.
                        market.cancel(order.featureCode, order.id);
                    } catch (RuntimeException e) {
                        log.warn("Market expiry retained reservation for {}: {}", order.id, e.getMessage());
                    }
                }
                // Seek rather than offset: cancelled rows disappear, failed rows must not block later ones.
                afterId = batch.get(batch.size() - 1).id;
                if (batch.size() < 50) return;
            }
        } catch (RuntimeException e) {
            log.error("Market expiry scan failed; persisted orders will be retried next run", e);
        } finally {
            running.set(false);
        }
    }
}
