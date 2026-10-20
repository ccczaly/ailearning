package com.ailearning.server;

import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api/me/memory")
public class UserMemoryController {
    private final Accounts accounts;
    private final UserMemoryService memories;
    public UserMemoryController(Accounts accounts, UserMemoryService memories) {
        this.accounts=accounts; this.memories=memories;
    }
    @GetMapping public ResponseEntity<UserMemoryService.Memory> get(Authentication auth) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(memories.get(accounts.profile(auth.getName()).id()));
    }
    @DeleteMapping public UserMemoryService.Memory clear(Authentication auth, @RequestParam long version) {
        return memories.clear(accounts.profile(auth.getName()).id(),version);
    }
    @PutMapping public UserMemoryService.Memory save(Authentication auth, @RequestBody UserMemoryService.Memory memory) {
        return memories.save(accounts.profile(auth.getName()).id(),memory);
    }
}
