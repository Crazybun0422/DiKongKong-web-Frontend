package com.example.dikongkongbackend.service;

import com.example.dikongkongbackend.entity.*;
import com.example.dikongkongbackend.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FlightMeetupOnlineServiceTest {
    final SocialPresenceService presence=mock(SocialPresenceService.class);
    final UserRepository users=mock(UserRepository.class);
    final MapLayerSettingRepository aircraft=mock(MapLayerSettingRepository.class);
    final MongoTemplate mongo=mock(MongoTemplate.class);
    final LocationSharingService sharing=mock(LocationSharingService.class);
    final SocialSettingsService settings=mock(SocialSettingsService.class);
    final FlightMeetupOnlineService service=new FlightMeetupOnlineService(presence,users,aircraft,mongo,sharing,settings);
    User user(String code) {User u=new User();u.setFeatureCode(code);u.setStatus("ACTIVE");u.setAvatarUrl("avatar-"+code+".png");return u;}
    void online(String... codes) {
        var states=new HashMap<String,SocialPresenceService.OnlineState>();
        for(String code:codes)states.put(code,new SocialPresenceService.OnlineState(Instant.now(),1));
        when(presence.onlineSnapshot()).thenReturn(new SocialPresenceService.OnlineSnapshot(Instant.now(),states));
    }
    @BeforeEach void setup() {when(settings.getConfig()).thenReturn(new SocialSettingsService.Config(false));}
    @Test void distanceSortPaginationAndUnknownLocation() {
        online("near","far","unknown");
        when(users.findByFeatureCodeIn(any())).thenReturn(List.of(user("far"),user("unknown"),user("near")));
        when(sharing.sharedPositions(anyList())).thenReturn(Map.of("near",new LocationSharingService.Position(31.,120.01,null),"far",new LocationSharingService.Position(31.,121.,null)));
        when(mongo.find(any(Query.class),eq(SocialProfileService.Extra.class))).thenReturn(List.of(new SocialProfileService.Extra("near",null,"一起飞")));
        MapLayerSetting model=new MapLayerSetting();model.setFeatureCode("near");model.setAircraftModel("DJI Air 3S");
        when(aircraft.findByFeatureCodeIn(any())).thenReturn(List.of(model));
        var first=service.list("self",31.,120.,0,2);
        assertEquals(List.of("near","far"),first.items().stream().map(FlightMeetupOnlineService.Person::featureCode).toList());
        assertTrue(first.hasMore());assertEquals(3,first.total());
        assertTrue(first.items().get(0).distanceMeters()<5000);assertTrue(first.items().get(1).distanceMeters()>50000);
        assertEquals("一起飞",first.items().get(0).signature());assertEquals("DJI Air 3S",first.items().get(0).aircraftModel());
        var last=service.list("self",31.,120.,1,2);assertNull(last.items().get(0).distanceMeters());assertFalse(last.hasMore());
        assertTrue(service.list("self",31.,120.,20,2).items().isEmpty());
        verify(presence,times(1)).onlineSnapshot();
    }
    @Test void excludesSelfBlockedExpiredAndDisabledAccounts() {
        online("self","blocked","blocks-me","expired","banned","active");
        var state=new HashMap<>(presence.onlineSnapshot().users());
        state.put("expired",new SocialPresenceService.OnlineState(Instant.now().minusSeconds(61),1));
        when(presence.onlineSnapshot()).thenReturn(new SocialPresenceService.OnlineSnapshot(Instant.now(),state));
        when(mongo.find(any(Query.class),eq(UserBlock.class))).thenReturn(List.of(new UserBlock("a","self","blocked",0),new UserBlock("b","blocks-me","self",0)));
        User banned=user("banned");banned.setStatus("BANNED");
        when(users.findByFeatureCodeIn(any())).thenAnswer(call->{List<String> codes=call.getArgument(0);assertEquals(List.of("active","banned"),codes);return List.of(user("active"),banned);});
        var result=service.list("self",null,null,0,5);
        assertEquals(1,result.total());assertNull(result.items().get(0).distanceMeters());verifyNoInteractions(sharing);
    }
    @Test void validatesBeforeReadingPresenceOrPositions() {
        assertThrows(ResponseStatusException.class,()->service.list("self",31.,null,0,20));
        assertThrows(ResponseStatusException.class,()->service.list("self",Double.NaN,120.,0,20));
        assertThrows(ResponseStatusException.class,()->service.list("self",null,null,-1,20));
        assertThrows(ResponseStatusException.class,()->service.list("self",null,null,0,51));
        verifyNoInteractions(presence,sharing,users);
    }
    @Test void closedSocialFeatureCannotExposeOnlineUsers() {
        when(settings.getConfig()).thenReturn(new SocialSettingsService.Config(true));
        assertEquals(403,assertThrows(ResponseStatusException.class,()->service.list("self",null,null,0,20)).getStatusCode().value());
        verifyNoInteractions(presence,sharing,users);
    }
    @Test void distanceHandlesSamePointAndDateLine() {
        assertEquals(0,FlightMeetupOnlineService.distance(31,120,31,120),.01);
        assertTrue(FlightMeetupOnlineService.distance(0,179.99,0,-179.99)<3000);
    }
    UserLocation location(String code,Double latitude,Double longitude) {
        var point=new UserLocation();point.setFeatureCode(code);point.setLatitude(latitude);point.setLongitude(longitude);return point;
    }
    @Test void ordinaryLocationDisplaysDistanceWithoutAnySharingSession() {
        online("near","invalid","unknown");
        when(users.findByFeatureCodeIn(any())).thenReturn(List.of(user("near"),user("invalid"),user("unknown")));
        when(sharing.sharedPositions(anyList())).thenReturn(Map.of());
        when(mongo.find(any(Query.class),eq(UserLocation.class))).thenReturn(List.of(location("near",31.,120.01),location("invalid",Double.NaN,120.)));
        var result=service.list("self",31.,120.,0,20);
        assertEquals("near",result.items().get(0).featureCode());
        assertTrue(result.items().get(0).distanceMeters()>0 && result.items().get(0).distanceMeters()<5000);
        assertNull(result.items().get(1).distanceMeters());assertNull(result.items().get(2).distanceMeters());
    }
    @Test void savedViewerLocationCanCalculateDistanceWithoutFreshGpsOrSharing() {
        online("near");when(users.findByFeatureCodeIn(any())).thenReturn(List.of(user("near")));
        when(mongo.findOne(any(Query.class),eq(UserLocation.class))).thenReturn(location("self",31.,120.));
        when(mongo.find(any(Query.class),eq(UserLocation.class))).thenReturn(List.of(location("near",31.,120.01)));
        assertNotNull(service.list("self",null,null,0,20).items().get(0).distanceMeters());
    }
    @Test void memberFlagUsesCurrentMembershipAndExpiryForPreviewAndDirectory() {
        online("active","today","permanent","expired","ordinary");
        var today=com.example.dikongkongbackend.util.DateTimeProvider.now().toLocalDate();
        User active=user("active"),lastDay=user("today"),permanent=user("permanent"),expired=user("expired"),ordinary=user("ordinary");
        active.setMember(true);active.setMemberExpireDate(today.plusDays(1));
        lastDay.setMember(true);lastDay.setMemberExpireDate(today);
        permanent.setMember(true);expired.setMember(true);expired.setMemberExpireDate(today.minusDays(1));
        ordinary.setMemberExpireDate(today.plusYears(1));
        when(users.findByFeatureCodeIn(any())).thenReturn(List.of(active,lastDay,permanent,expired,ordinary));
        for(int size:List.of(5,20)) {
            var flags=new HashMap<String,Boolean>();
            service.list("self",null,null,0,size).items().forEach(p->flags.put(p.featureCode(),p.member()));
            assertEquals(Map.of("active",true,"today",true,"permanent",true,"expired",false,"ordinary",false),flags);
        }
    }
}
