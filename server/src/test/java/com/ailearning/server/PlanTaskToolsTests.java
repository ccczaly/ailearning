package com.ailearning.server;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.*;

class PlanTaskToolsTests {
    JdbcTemplate database() {
        var jdbc = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.execute("CREATE TABLE ai_plan_drafts(user_id BIGINT,conversation_id BIGINT,draft_json LONGTEXT,status VARCHAR(32),PRIMARY KEY(user_id,conversation_id))");
        return jdbc;
    }
    @Test void partialTurnsPersistAndPreviewRequiresAllConfirmedFields() {
        var jdbc = database();
        var defaults = new AiPlanController.Preferences("app","beginner",30,java.util.List.of(1));
        var tools = new PlanTaskTools(jdbc,1,10,defaults);
        var initial = tools.prepare().call("{}");
        assertTrue(initial.contains("needs_input"));
        assertTrue(initial.contains("goal"));
        assertNull(tools.proposal());
        assertTrue(tools.generate().call("{}").contains("needs_input"));
        tools.prepare().call("{\"schedule\":[{\"date\":\"2026-11-09\",\"weekday\":1,\"slots\":[{\"startTime\":\"20:17\",\"endTime\":\"22:17\"}]}]}");
        // Reconstruct on each turn, exactly as the chat endpoint does.
        tools = new PlanTaskTools(jdbc,1,10,defaults);
        assertTrue(tools.prepare().call("{\"goal\":\"agent\"}").contains("needs_input"));
        assertTrue(tools.prepare().call("{\"level\":\"beginner\"}").contains("ready"));
        assertTrue(tools.generate().call("{}").contains("preview_pending"));
        assertEquals("20:17", tools.proposal().schedule().getFirst().slots().getFirst().startTime());
        assertEquals("agent", tools.proposal().goal());
        assertTrue(new PlanTaskTools(jdbc,2,10,defaults).prepare().call("{}").contains("needs_input"));
        assertTrue(new PlanTaskTools(jdbc,1,11,defaults).prepare().call("{}").contains("needs_input"));
        assertTrue(tools.prepare().call("{\"reset\":true}").contains("needs_input"));
        assertNull(tools.proposal());
    }
    @Test void datePatchPreservesOtherDatesAndInvalidInputDoesNotOverwriteDraft() {
        var jdbc = database();
        var tools = new PlanTaskTools(jdbc,1,10,null);
        tools.prepare().call("{\"goal\":\"agent\",\"schedule\":[{\"date\":\"2026-11-09\",\"weekday\":1,\"slots\":[{\"startTime\":\"09:00\",\"endTime\":\"11:00\"}]}]}");
        tools.prepare().call("{\"schedule\":[{\"date\":\"2026-11-10\",\"weekday\":2,\"slots\":[{\"startTime\":\"14:00\",\"endTime\":\"16:00\"}]}]}");
        assertTrue(tools.prepare().call("{\"goal\":\"invalid\"}").contains("invalid_input"));
        var draft = tools.prepare().call("{}");
        assertTrue(draft.contains("2026-11-09"));
        assertTrue(draft.contains("2026-11-10"));
        assertTrue(draft.contains("agent"));
    }
}
