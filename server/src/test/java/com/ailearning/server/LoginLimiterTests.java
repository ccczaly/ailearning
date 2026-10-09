package com.ailearning.server;

import java.time.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class LoginLimiterTests {
    @Test void accountLimitAcrossIpsAndWindowRecovery() {
        class MutableClock extends Clock {
            long millis;
            public ZoneId getZone() { return ZoneOffset.UTC; }
            public Clock withZone(ZoneId zone) { return this; }
            public Instant instant() { return Instant.ofEpochMilli(millis); }
        }
        var clock = new MutableClock();
        var limiter = new LoginLimiter(clock);
        for (int i=0;i<5;i++) assertTrue(limiter.acquire("ip"+i, "Example"));
        assertFalse(limiter.acquire("new-ip", "example"));
        clock.millis=60001;
        assertTrue(limiter.acquire("new-ip", "example"));
    }
    @Test void ipLimitAcrossAccounts() {
        var limiter = new LoginLimiter();
        for (int i=0;i<30;i++) assertTrue(limiter.acquire("one-ip", "user"+i));
        assertFalse(limiter.acquire("one-ip", "another-user"));
    }
}
