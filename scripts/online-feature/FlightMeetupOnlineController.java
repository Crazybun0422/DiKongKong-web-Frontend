package com.example.dikongkongbackend.controller;

import com.example.dikongkongbackend.dto.ApiResponse;
import com.example.dikongkongbackend.service.FlightMeetupOnlineService;
import com.example.dikongkongbackend.service.UserTokenService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;

@RestController
@RequestMapping("/api/flight-meetups/online")
public class FlightMeetupOnlineController {
    private final FlightMeetupOnlineService service;
    private final UserTokenService tokens;
    public FlightMeetupOnlineController(FlightMeetupOnlineService service,UserTokenService tokens) {
        this.service=service; this.tokens=tokens;
    }
    @GetMapping public ApiResponse<?> list(@RequestHeader(value="Authorization",required=false) String auth,
            @RequestParam(required=false) Double latitude,@RequestParam(required=false) Double longitude,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        if(auth==null || !auth.startsWith("Bearer ")) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"请先登录");
        var user=tokens.resolveUser(auth.substring(7)).filter(u -> "ACTIVE".equals(u.getStatus()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,"请先登录"));
        return new ApiResponse<>(true,Map.of("zh","操作成功","en","okay"),
                service.list(user.getFeatureCode(),latitude,longitude,page,size));
    }
    @ExceptionHandler(ResponseStatusException.class) public ResponseEntity<ApiResponse<Void>> error(ResponseStatusException ex) {
        String message=ex.getReason()==null?"在线列表加载失败":ex.getReason();
        return ResponseEntity.status(ex.getStatusCode()).body(new ApiResponse<>(false,Map.of("zh",message,"en",message),null));
    }
}
