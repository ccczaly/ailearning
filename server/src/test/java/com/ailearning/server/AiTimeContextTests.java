package com.ailearning.server;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AiTimeContextTests {
    @Test void convertsUtcToShanghaiIncludingDateAndWeekdayRollover() {
        var text = AiTimeContext.from(Clock.fixed(Instant.parse("2026-11-06T16:05:09Z"), ZoneOffset.UTC));
        assertTrue(text.contains("当前日期：2026-11-07"));
        assertTrue(text.contains("当前时间：00:05:09"));
        assertTrue(text.contains("星期六"));
        assertTrue(text.contains("Asia/Shanghai"));
    }
    @Test void freshRequestsUseTheirOwnTimeInsteadOfAnInitializationTimestamp() {
        var first = AiTimeContext.from(Clock.fixed(Instant.parse("2026-11-06T15:59:59Z"), ZoneOffset.UTC));
        var next = AiTimeContext.from(Clock.fixed(Instant.parse("2026-11-06T16:00:00Z"), ZoneOffset.UTC));
        assertTrue(first.contains("当前日期：2026-11-06"));
        assertTrue(next.contains("当前日期：2026-11-07"));
    }

    @Test void timeToolReadsTheClockAtEveryInvocation() {
        var tool = new AiTimeTool(Clock.fixed(Instant.parse("2026-11-06T16:05:09Z"), ZoneOffset.UTC));
        assertEquals("get_current_time", tool.getToolDefinition().name());
        assertTrue(tool.call("{}").contains("当前日期：2026-11-07"));
        assertTrue(tool.call("{}").contains("当前时间：00:05:09"));
    }
}
