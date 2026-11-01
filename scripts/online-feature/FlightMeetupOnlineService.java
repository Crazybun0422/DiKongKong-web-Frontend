package com.example.dikongkongbackend.service;

import com.example.dikongkongbackend.entity.User;
import com.example.dikongkongbackend.entity.UserBlock;
import com.example.dikongkongbackend.entity.UserLocation;
import com.example.dikongkongbackend.util.DateTimeProvider;
import com.example.dikongkongbackend.repository.UserRepository;
import com.example.dikongkongbackend.repository.MapLayerSettingRepository;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Service
public class FlightMeetupOnlineService {
    public record Person(String featureCode, String avatarUrl, boolean member, String signature, String aircraftModel, Long distanceMeters) {}
    public record OnlinePage(List<Person> items, long total, boolean hasMore) {}
    private final SocialPresenceService presence;
    private final UserRepository users;
    private final MapLayerSettingRepository aircraft;
    private final MongoTemplate mongo;
    private final LocationSharingService sharing;
    private final SocialSettingsService settings;
    private volatile SocialPresenceService.OnlineSnapshot cachedPresence;

    public FlightMeetupOnlineService(SocialPresenceService presence, UserRepository users,
            MapLayerSettingRepository aircraft, MongoTemplate mongo, LocationSharingService sharing,
            SocialSettingsService settings) {
        this.presence=presence; this.users=users; this.aircraft=aircraft; this.mongo=mongo;
        this.sharing=sharing; this.settings=settings;
    }
    private synchronized SocialPresenceService.OnlineSnapshot snapshot() {
        if(cachedPresence==null || System.currentTimeMillis()-cachedPresence.sampledAt().toEpochMilli()>=5000)
            cachedPresence=presence.onlineSnapshot();
        return cachedPresence;
    }
    public OnlinePage list(String viewer, Double latitude, Double longitude, int page, int size) {
        if(settings.getConfig().closed()) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"社交功能暂未开放");
        if(page<0 || page>100000 || size<1 || size>50 || (latitude==null)!=(longitude==null)
                || (latitude!=null && (!Double.isFinite(latitude)||!Double.isFinite(longitude)
                || Math.abs(latitude)>90 || Math.abs(longitude)>180)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"无效的查询参数");
        // Distance is independent of the shared-map session. Use the viewer's
        // normal saved location when a fresh device fix is unavailable.
        UserLocation savedOrigin=latitude==null
                ?mongo.findOne(Query.query(Criteria.where("featureCode").is(viewer)),UserLocation.class):null;
        Double originLat=latitude!=null?latitude:validLocation(savedOrigin)?savedOrigin.getLatitude():null;
        Double originLng=longitude!=null?longitude:validLocation(savedOrigin)?savedOrigin.getLongitude():null;
        Set<String> excluded=new HashSet<>(); excluded.add(viewer);
        mongo.find(Query.query(new Criteria().orOperator(Criteria.where("owner").is(viewer),
                Criteria.where("blocked").is(viewer))),UserBlock.class).forEach(block -> {
            excluded.add(block.owner()); excluded.add(block.blocked());
        });
        long cutoff=System.currentTimeMillis()-SocialPresenceService.ONLINE_TIMEOUT_MILLIS;
        List<String> codes=snapshot().users().entrySet().stream()
                .filter(e -> !excluded.contains(e.getKey()) && e.getValue().lastHeartbeatAt()!=null
                        && e.getValue().lastHeartbeatAt().toEpochMilli()>cutoff)
                .map(Map.Entry::getKey).sorted().toList();
        List<User> candidates=new ArrayList<>();
        Map<String,LocationSharingService.Position> positions=new HashMap<>();
        for(int i=0;i<codes.size();i+=500) {
            var batch=codes.subList(i,Math.min(i+500,codes.size()));
            users.findByFeatureCodeIn(batch).stream().filter(u -> "ACTIVE".equals(u.getStatus())).forEach(candidates::add);
            if(originLat!=null) {
                positions.putAll(sharing.sharedPositions(batch));
                // Ordinary location records remain usable with sharing switched off.
                mongo.find(Query.query(Criteria.where("featureCode").in(batch)),UserLocation.class)
                        .stream().filter(FlightMeetupOnlineService::validLocation)
                        .forEach(p -> positions.put(p.getFeatureCode(),new LocationSharingService.Position(p.getLatitude(),p.getLongitude(),null)));
            }
        }
        Map<String,Long> distances=new HashMap<>();
        positions.forEach((code,p) -> distances.put(code,Math.round(distance(originLat,originLng,p.latitude(),p.longitude()))));
        candidates.sort(Comparator.<User,Long>comparing(u -> distances.get(u.getFeatureCode()),
                Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(User::getFeatureCode));
        int from=Math.min(page*size,candidates.size()),to=Math.min(from+size,candidates.size());
        var selected=candidates.subList(from,to);
        var selectedCodes=selected.stream().map(User::getFeatureCode).toList();
        Map<String,String> signatures=new HashMap<>(),models=new HashMap<>();
        if(!selectedCodes.isEmpty()) {
            mongo.find(Query.query(Criteria.where("_id").in(selectedCodes)),SocialProfileService.Extra.class)
                    .forEach(p -> signatures.put(p.id(),Objects.toString(p.signature(),"")));
            aircraft.findByFeatureCodeIn(selectedCodes).forEach(p -> models.put(p.getFeatureCode(),Objects.toString(p.getAircraftModel(),"")));
        }
        var today=DateTimeProvider.now().toLocalDate();
        return new OnlinePage(selected.stream().map(u -> new Person(u.getFeatureCode(),u.getAvatarUrl(),
                u.isMember() && (u.getMemberExpireDate()==null || !u.getMemberExpireDate().isBefore(today)),
                signatures.getOrDefault(u.getFeatureCode(),""),models.getOrDefault(u.getFeatureCode(),""),
                distances.get(u.getFeatureCode()))).toList(),candidates.size(),to<candidates.size());
    }
    private static boolean validLocation(UserLocation p) {
        return p!=null && p.getLatitude()!=null && p.getLongitude()!=null
                && Double.isFinite(p.getLatitude()) && Double.isFinite(p.getLongitude())
                && Math.abs(p.getLatitude())<=90 && Math.abs(p.getLongitude())<=180;
    }
    static double distance(double lat1,double lng1,double lat2,double lng2) {
        double a=Math.pow(Math.sin(Math.toRadians(lat2-lat1)/2),2)
                +Math.cos(Math.toRadians(lat1))*Math.cos(Math.toRadians(lat2))
                *Math.pow(Math.sin(Math.toRadians(lng2-lng1)/2),2);
        return 6371000*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))));
    }
}
