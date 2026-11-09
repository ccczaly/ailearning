package com.ailearning.server;

import java.time.Clock;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Rebuilt for each request; independent of the host machine's default time zone. */
final class AiTimeContext {
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private AiTimeContext() {}
    static String current() { return from(Clock.systemUTC()); }
    static String from(Clock clock) {
        var now = ZonedDateTime.now(clock).withZoneSameInstant(ZONE);
        return """
            【本次请求的实时时间】
            当前日期：%s
            当前时间：%s
            星期：%s
            时区：Asia/Shanghai（UTC+08:00）
            回答今天、现在、明天、下周等时间问题时以此为准，不沿用历史消息中的日期，也不把知识截止时间当成当前日期。
            未明确其他时区时按上述时区理解；用户明确指定其他时区时按其要求换算。
            """.formatted(now.toLocalDate(), now.format(DateTimeFormatter.ofPattern("HH:mm:ss")),
                now.format(DateTimeFormatter.ofPattern("EEEE", Locale.SIMPLIFIED_CHINESE)));
    }
}
