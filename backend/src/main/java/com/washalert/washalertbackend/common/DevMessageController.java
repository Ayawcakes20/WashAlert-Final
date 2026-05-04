package com.washalert.washalertbackend.common;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;

/**
 * Suppresses Metro Bundler (Expo) dev-server WebSocket handshake logs.
 * When the backend is on 8081, the mobile app often pings /message thinking it's the Metro server.
 */
@RestController
public class DevMessageController {

    @RequestMapping("/message")
    public ResponseEntity<Void> ignoreMetroMessage() {
        return ResponseEntity.ok().build();
    }
}
