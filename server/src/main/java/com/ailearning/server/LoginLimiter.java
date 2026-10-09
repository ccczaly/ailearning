package com.ailearning.server;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Fixed windows, bounded storage; reservations also cap concurrent password hashing. */
@Component
public class LoginLimiter {
    private record Window(int count, long until) {}
    private final Map<String, Window> windows = new HashMap<>();
    private final Clock clock;
    public LoginLimiter() { this(Clock.systemUTC()); }
    LoginLimiter(Clock clock) { this.clock = clock; }
    public synchronized boolean acquire(String ip, String username) {
        long now = clock.millis();
        windows.entrySet().removeIf(entry -> entry.getValue().until() <= now);
        String account = "user:" + Accounts.normalize(username);
        String source = "ip:" + ip;
        if (windows.size() >= 10000 || count(account) >= 5 || count(source) >= 30) return false;
        increment(account, now); increment(source, now);
        return true;
    }
    public synchronized void success(String username) { windows.remove("user:" + Accounts.normalize(username)); }
    private int count(String key) { return windows.containsKey(key) ? windows.get(key).count() : 0; }
    private void increment(String key, long now) {
        var old = windows.get(key);
        windows.put(key, new Window(count(key) + 1, old == null ? now + 60000 : old.until()));
    }
}
