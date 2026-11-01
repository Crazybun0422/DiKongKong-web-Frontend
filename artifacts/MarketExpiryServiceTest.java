package com.example.dikongkongbackend.service;

import com.example.dikongkongbackend.entity.MarketOrder;
import com.example.dikongkongbackend.repository.MarketOrderRepository;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.mockito.Mockito.*;

class MarketExpiryServiceTest {
    @Test void failedFirstBatchDoesNotStarveLaterOrdersAndIsRetriedNextRun() {
        var orders = mock(MarketOrderRepository.class);
        var market = mock(MarketService.class);
        List<MarketOrder> first = new ArrayList<>();
        for (int i=0; i<50; i++) {
            var order = new MarketOrder(); order.id=String.format("order-%03d",i); order.featureCode="ABC123";
            first.add(order);
            doThrow(new IllegalStateException("payment provider unavailable")).when(market).cancel("ABC123",order.id);
        }
        var last = new MarketOrder(); last.id="order-050"; last.featureCode="ABC123";
        when(orders.findExpiredBatch(any(Instant.class),eq(""),any())).thenReturn(first);
        when(orders.findExpiredBatch(any(Instant.class),eq("order-049"),any())).thenReturn(List.of(last));
        var expiry = new MarketExpiryService(orders,market);
        expiry.expire();
        verify(market).cancel("ABC123","order-050");
        expiry.expire();
        verify(market,times(2)).cancel("ABC123","order-000");
    }

    @Test void databaseScanFailureDoesNotDisableFutureRuns() {
        var orders=mock(MarketOrderRepository.class);
        var market=mock(MarketService.class);
        when(orders.findExpiredBatch(any(),eq(""),any())).thenThrow(new IllegalStateException("database unavailable")).thenReturn(List.of());
        var expiry=new MarketExpiryService(orders,market);
        expiry.expire(); expiry.expire();
        verify(orders,times(2)).findExpiredBatch(any(),eq(""),any());
    }
}
