package com.ailearning.server;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class RegistrationController {
    private final Registration registration;
    private final LoginLimiter limiter = new LoginLimiter();
    public RegistrationController(Registration registration) { this.registration = registration; }

    @PostMapping(value="/api/auth/register", consumes="application/x-www-form-urlencoded")
    public ResponseEntity<?> register(@RequestParam(defaultValue="") String username,
            @RequestParam(defaultValue="") String password, HttpServletRequest request) {
        username = Accounts.normalize(username);
        if (!username.matches("[a-z0-9_.-]{3,64}"))
            return ResponseEntity.badRequest().body(Map.of("code", "INVALID_USERNAME"));
        if (password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            return ResponseEntity.badRequest().body(Map.of("code", "INVALID_PASSWORD"));
        if (!limiter.acquire(request.getRemoteAddr(), username))
            return ResponseEntity.status(429).header("Retry-After", "60").body(Map.of("code", "REGISTER_RATE_LIMITED"));
        try { registration.create(username, password); }
        catch (DuplicateKeyException ex) {
            return ResponseEntity.status(409).body(Map.of("code", "USERNAME_TAKEN"));
        }
        return ResponseEntity.noContent().build();
    }
}
