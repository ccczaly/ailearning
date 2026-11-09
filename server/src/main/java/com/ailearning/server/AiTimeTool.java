package com.ailearning.server;

import java.time.Clock;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;

/** Reads the clock at execution time, never reuses a historical timestamp. */
final class AiTimeTool implements ToolCallback {
    private final Clock clock;
    AiTimeTool() { this(Clock.systemUTC()); }
    AiTimeTool(Clock clock) { this.clock = clock; }
    public ToolDefinition getToolDefinition() {
        return ToolDefinition.builder().name("get_current_time")
            .description("查询当前日期、时间、星期及Asia/Shanghai时区。回答依赖当前时间的问题时调用，包括今天几号、现在几点、明天、下周、距月底几天；不要使用历史时间。无需参数。")
            .inputSchema("{\"type\":\"object\",\"properties\":{},\"additionalProperties\":false}").build();
    }
    public String call(String input) { return AiTimeContext.from(clock); }
}
