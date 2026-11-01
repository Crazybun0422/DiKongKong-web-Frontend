package com.example.dikongkongbackend.service;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.*;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class OnlineSharedPositionTest {
    @Test void onlyExplicitUnexpiredLocationsAreUsedWithoutCreatingASession() throws Exception {
        var redis=mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked") ValueOperations<String,String> values=mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        long now=1800000000000L;var mapper=new ObjectMapper();
        var service=new LocationSharingService(redis,mapper,mock(UserProfileKvService.class),Clock.fixed(Instant.ofEpochMilli(now),ZoneOffset.UTC));
        var live=new LocationSharingService.Participant("live","","","",false,31,120,0,now);
        var old=new LocationSharingService.Participant("expired","","","",false,31,120,0,now-45000);
        when(values.multiGet(anyCollection())).thenReturn(Arrays.asList(mapper.writeValueAsString(new LocationSharingService.Session("a",live)),mapper.writeValueAsString(new LocationSharingService.Session("b",old)),null,"invalid"));
        assertEquals(Set.of("live"),service.sharedPositions(List.of("live","expired","cleared","bad")).keySet());
        verify(values).multiGet(List.of("location-sharing:{sessions}:user:live","location-sharing:{sessions}:user:expired","location-sharing:{sessions}:user:cleared","location-sharing:{sessions}:user:bad"));
        verifyNoMoreInteractions(values);
    }
}
