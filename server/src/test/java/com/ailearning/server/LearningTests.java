package com.ailearning.server;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class LearningTests {
    @Autowired LearningController learning;
    @Autowired JdbcTemplate jdbc;
    @Autowired LearningModuleController modules;
    @Test void modulesHavePublishedEntriesAndStableOrder() {
        var rows = modules.list();
        assertEquals(8, rows.size());
        assertEquals("llm-basics", rows.getFirst().code());
        assertEquals("llm-basics", rows.getFirst().entrySlug());
        assertTrue(rows.stream().skip(1).allMatch(m -> m.entrySlug() == null));
        jdbc.update("UPDATE knowledge_points SET status='DRAFT' WHERE slug='llm-basics'");
        assertNull(modules.list().getFirst().entrySlug());
        jdbc.update("UPDATE learning_modules SET status='ARCHIVED' WHERE code='llm-basics'");
        assertEquals(7, modules.list().size());
        assertEquals("prompt-output", modules.list().getFirst().code());
    }
    @Test void seededContentIncludesNestedLessons() {
        var point = learning.detail("llm-basics");
        assertEquals("LLM 基础", point.title());
        assertEquals(5, point.sections().stream().filter(s -> s.nodeType().equals("LESSON")).count());
        assertTrue(point.sections().stream().anyMatch(s -> s.title().equals("Token 与上下文") && s.parentId() == 3L));
    }
    @Test void unpublishedAncestorsHideTheirDescendants() {
        jdbc.update("UPDATE knowledge_sections SET status='DRAFT' WHERE id=3");
        assertFalse(learning.detail("llm-basics").sections().stream().anyMatch(s -> Long.valueOf(3).equals(s.parentId())));
        jdbc.update("UPDATE learning_modules SET status='DRAFT' WHERE id=1");
        assertThrows(ResponseStatusException.class, () -> learning.detail("llm-basics"));
    }
    @Test void unknownPointIsNotFound() {
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> learning.detail("missing")).getStatusCode().value());
    }
}
