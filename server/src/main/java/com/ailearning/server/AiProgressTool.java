package com.ailearning.server;

import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.execution.ToolExecutionException;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;

/** Per-request identity binding: no user identifier or write operation is exposed to the model. */
final class AiProgressTool implements ToolCallback {
    static final String NAME="get_current_learning_progress";
    private static final ObjectMapper JSON=new ObjectMapper();
    private static final ToolDefinition DEFINITION=ToolDefinition.builder()
        .name(NAME)
        .description("只读查询当前登录账号的最新学习进度：各模块总课节、已完成和已访问数量、最近阅读课节及链接。用户询问学习进度、完成情况、上次学到哪里时调用；参数只能是空对象 {}，不能指定或切换账号。访问不代表完成。")
        .inputSchema("{\"type\":\"object\",\"properties\":{},\"additionalProperties\":false}")
        .build();
    private volatile AiLearningProgress.Snapshot result;
    private final long userId;
    private final AiLearningProgress progress;

    AiProgressTool(long userId, AiLearningProgress progress) {
        this.userId=userId; this.progress=progress;
    }

    java.util.List<AiAction> actions() {
        var snapshot=result;
        if(snapshot==null) return java.util.List.of();
        var next=snapshot.nextLesson();
        if(next!=null) return java.util.List.of(new AiAction("continue_learning","继续学习",next.url()));
        if(snapshot.totalLessons()>0 && snapshot.lastVisited()!=null)
            return java.util.List.of(new AiAction("review_course","复习课程",snapshot.lastVisited().url()));
        return java.util.List.of();
    }

    @Override public ToolDefinition getToolDefinition() { return DEFINITION; }

    @Override public String call(String arguments) {
        try {
            var input=JSON.readTree(arguments==null || arguments.isBlank() ? "{}" : arguments);
            // This tool has no model-controlled inputs. Providers may emit null or
            // extra object fields despite the schema; never use them for identity,
            // filtering, or writes. The authenticated userId remains authoritative.
            if(input==null || (!input.isObject() && !input.isNull()))
                throw new IllegalArgumentException();
        } catch(Exception invalid) {
            throw new ToolExecutionException(DEFINITION,new AiException(HttpStatus.BAD_REQUEST,"AI_TOOL_ARGUMENTS_INVALID"));
        }
        try {
            var snapshot=progress.read(userId);
            String json=JSON.writeValueAsString(snapshot);
            result=snapshot;
            return json;
        } catch(RuntimeException unavailable) {
            // Never expose SQL, credentials, or low-level exception messages to the model or browser.
            throw new ToolExecutionException(DEFINITION,new AiException(HttpStatus.SERVICE_UNAVAILABLE,"AI_PROGRESS_UNAVAILABLE"));
        }
    }
}
