package com.ailearning.server;

import java.util.*;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

/** One persisted draft per owned conversation. UI defaults never count as confirmed input. */
final class PlanTaskTools {
    private static final ObjectMapper JSON = new ObjectMapper();
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    record Draft(String goal, String level, List<AiPlanController.StudyDay> schedule) {}
    record Result(String status, Draft draft, List<String> missingFields) {}
    record Patch(String goal, String level, List<AiPlanController.StudyDay> schedule, Boolean reset, Boolean useCurrent) {}
    private final JdbcTemplate jdbc;
    private final long userId, conversationId;
    private final AiPlanController.Preferences current;
    private AiPlanController.Preferences proposal;
    PlanTaskTools(JdbcTemplate jdbc, long userId, long conversationId, AiPlanController.Preferences current) {
        this.jdbc = jdbc; this.userId = userId; this.conversationId = conversationId; this.current = current;
    }
    AiPlanController.Preferences proposal() { return proposal; }
    private Draft read() {
        return jdbc.query("SELECT draft_json FROM ai_plan_drafts WHERE user_id=? AND conversation_id=?",
            (rs,n) -> JSON.readValue(rs.getString(1), Draft.class), userId, conversationId).stream()
            .findFirst().orElse(new Draft(null, null, null));
    }
    private void save(Draft draft, String status) {
        jdbc.update("""
            INSERT INTO ai_plan_drafts(user_id,conversation_id,draft_json,status) VALUES(?,?,?,?)
            ON DUPLICATE KEY UPDATE draft_json=VALUES(draft_json),status=VALUES(status)
            """, userId, conversationId, JSON.writeValueAsString(draft), status);
    }
    static Result inspect(Draft draft) {
        var missing = new ArrayList<String>();
        if (draft.goal() == null) missing.add("goal");
        if ((draft.schedule() == null || draft.schedule().isEmpty() || draft.schedule().stream().allMatch(day -> day.slots().isEmpty()))) missing.add("schedule");
        return new Result(missing.isEmpty() ? "ready" : "needs_input", draft, missing);
    }
    static Draft merge(Draft old, Patch patch) {
        if (patch.goal() != null && !List.of("agent","app","rag","foundation","all").contains(patch.goal())) throw new IllegalArgumentException("学习目标无效");
        if (patch.level() != null && !List.of("beginner","familiar","experienced").contains(patch.level())) throw new IllegalArgumentException("基础选项无效");
        var schedule = old.schedule();
        if (patch.schedule() != null) {
            if (!AiPlanController.validSchedule(patch.schedule())) throw new IllegalArgumentException("日期、星期或时段无效；请检查重复日期与重叠时段");
            var dates = new TreeMap<String, AiPlanController.StudyDay>();
            if (schedule != null) for (var day : schedule) dates.put(day.date(), day);
            for (var day : patch.schedule()) dates.put(day.date(), day);
            schedule = List.copyOf(dates.values());
        }
        return new Draft(patch.goal() == null ? old.goal() : patch.goal(), patch.level() == null ? old.level() : patch.level(), schedule);
    }
    ToolCallback prepare() {
        return callback("prepare_learning_plan", "识别到创建或调整学习计划时先调用，即使没有参数也调用。收集学习内容和大概时间，将自然语言展开为具体日期、weekday和多个分钟级slots；保留工作日与周末等时间差异。无需用户提供准确钟点，模糊部分自行合理推断并说明。缺项最多追问一轮，下一次prepare自动补默认值；用户说直接安排时直接调用生成工具。schedule按日期合并，某天slots=[]表示取消当天学习。reset只用于用户明确新建计划，useCurrent只用于用户明确沿用已有计划。",
            PREPARE_SCHEMA, input -> {
                var patch = JSON.readValue(input, Patch.class);
                boolean alreadyAsked = !Boolean.TRUE.equals(patch.reset()) && jdbc.queryForObject("SELECT COUNT(*) FROM ai_plan_drafts WHERE user_id=? AND conversation_id=? AND status='needs_input'", Integer.class, userId, conversationId) > 0;
                var draft = Boolean.TRUE.equals(patch.reset()) ? new Draft(null,null,null) : read();
                if (Boolean.TRUE.equals(patch.useCurrent()) && current != null)
                    draft = new Draft(current.goal(), current.level(), current.schedule());
                draft = merge(draft, patch);
                if (alreadyAsked) draft = defaults(draft);
                var result = inspect(draft);
                save(draft, result.status()); proposal = null;
                return JSON.writeValueAsString(result);
            });
    }
    ToolCallback generate() {
        return callback("generate_learning_plan_preview", "条件足够或已追问一轮后调用，无需重复传参数。剩余缺项自动按全部课程、零基础、每天60分钟补齐；成功只生成待用户确认的预览，不保存正式计划。", "{\"type\":\"object\",\"properties\":{},\"additionalProperties\":false}", input -> {
            var draft = defaults(read());
            var value = new AiPlanController.Preferences(draft.goal(),draft.level(),0,List.of(),null,draft.schedule());
            if (!AiPlanController.valid(value)) throw new IllegalArgumentException("草稿参数无效");
            save(draft, "preview_pending"); proposal = value;
            return JSON.writeValueAsString(new Result("preview_pending", draft, List.of()));
        });
    }
    static Draft defaults(Draft draft) {
        return defaults(draft, java.time.LocalDate.now(java.time.ZoneId.of("Asia/Shanghai")));
    }
    static Draft defaults(Draft draft, java.time.LocalDate start) {
        var schedule = draft.schedule();
        // Only a completely absent schedule receives defaults. Never overwrite
        // user-provided dates, multiple slots, or explicitly empty rest days.
        if (schedule == null || schedule.isEmpty()) {
            var dates = new ArrayList<AiPlanController.StudyDay>();
            for (int offset = 0; offset < 28; offset++) {
                var date = start.plusDays(offset);
                dates.add(new AiPlanController.StudyDay(date.toString(), date.getDayOfWeek().getValue(),
                    List.of(new AiPlanController.Slot("19:00", "20:00"))));
            }
            schedule = List.copyOf(dates);
        }
        return new Draft(draft.goal() == null ? "all" : draft.goal(),
            draft.level() == null ? "beginner" : draft.level(), schedule);
    }
    interface Operation { String run(String input); }
    private ToolCallback callback(String name, String description, String schema, Operation operation) {
        return new ToolCallback() {
            public ToolDefinition getToolDefinition() { return ToolDefinition.builder().name(name).description(description).inputSchema(schema).build(); }
            public String call(String input) {
                try { synchronized (PlanTaskTools.this) { return operation.run(input); } }
                catch (IllegalArgumentException invalid) { return JSON.writeValueAsString(Map.of("status","invalid_input","message",invalid.getMessage())); }
            }
        };
    }
    private static final String PREPARE_SCHEMA = """
        {"type": "object", "properties": {"goal": {"type": "string", "enum": ["agent", "app", "rag", "foundation", "all"]}, "level": {"type": "string", "enum": ["beginner", "familiar", "experienced"]}, "schedule": {"type": "array", "minItems": 1, "items": {"type": "object", "properties": {"date": {"type": "string", "description": "具体日期 YYYY-MM-DD"}, "weekday": {"type": "integer", "minimum": 1, "maximum": 7}, "slots": {"type": "array", "items": {"type": "object", "properties": {"startTime": {"type": "string"}, "endTime": {"type": "string"}}, "required": ["startTime", "endTime"], "additionalProperties": false}}}, "required": ["date", "weekday", "slots"], "additionalProperties": false}}, "reset": {"type": "boolean"}, "useCurrent": {"type": "boolean"}}, "additionalProperties": false}
        """;
}
