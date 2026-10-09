package com.ailearning.server;

import java.util.Map;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;

@RestController
public class AuthController {
    private final Accounts accounts;
    public AuthController(Accounts accounts) { this.accounts = accounts; }
    @GetMapping("/api/auth/csrf") public Map<String, String> csrf(CsrfToken token) {
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }
    @GetMapping("/api/me") public Accounts.Profile me(Authentication authentication) {
        return accounts.profile(authentication.getName());
    }
    @GetMapping("/api/admin/status") public Map<String, String> admin() { return Map.of("status", "ok"); }
}
