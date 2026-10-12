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
        assertEquals(9, rows.size());
        assertEquals(java.util.List.of("编程与工程基础", "大模型基础", "LLM 应用开发", "RAG 与知识检索", "AI Agent", "MCP 与工具生态", "多模态 AI", "AI 工程化", "部署与基础设施"), rows.stream().map(m -> m.title()).toList());
        assertEquals("llm-basics", rows.get(1).entrySlug());
        assertTrue(rows.stream().filter(m -> !m.code().equals("llm-basics")).allMatch(m -> m.entrySlug() == null));
        jdbc.update("UPDATE knowledge_points SET status='DRAFT' WHERE slug='llm-basics'");
        assertNull(modules.list().get(1).entrySlug());
        jdbc.update("UPDATE learning_modules SET status='ARCHIVED' WHERE code='llm-basics'");
        assertEquals(8, modules.list().size());
        assertEquals("engineering-basics", modules.list().getFirst().code());
    }
    @Test void timelineCourseHasOrderedCompleteLessons() {
        var point = learning.detail("llm-basics");
        assertEquals("沿着时间线认识大语言模型", point.title());
        var directories = point.sections().stream().filter(s -> s.nodeType().equals("DIRECTORY")).toList();
        var lessons = point.sections().stream().filter(s -> s.nodeType().equals("LESSON")).toList();
        assertEquals(14, directories.size());
        assertEquals(28, lessons.size());
        assertEquals(397, point.estimatedMinutes());
        assertEquals(point.estimatedMinutes().intValue(), lessons.stream().mapToInt(s -> s.estimatedMinutes()).sum());
        assertEquals("1950 年代起 · 机器能使用人类语言吗？", directories.getFirst().title());
        assertEquals("综合实验：评测一个物流问答助手", lessons.getLast().title());
        for (int i = 0; i < directories.size(); i++) {
            assertEquals("DIRECTORY", point.sections().get(i * 3).nodeType());
            assertEquals(directories.get(i).id(), point.sections().get(i * 3 + 1).parentId());
            assertEquals(directories.get(i).id(), point.sections().get(i * 3 + 2).parentId());
        }
        assertTrue(lessons.stream().allMatch(s -> s.contentMarkdown().length() >= 500 && s.contentMarkdown().contains("## 自测与解析") && s.contentMarkdown().contains("https://")));
        assertEquals(8, jdbc.queryForObject("SELECT COUNT(*) FROM knowledge_sections WHERE id BETWEEN 1 AND 8 AND status='ARCHIVED'", Integer.class));
    }
    @Test void unpublishedAncestorsHideTheirDescendants() {
        var directory = learning.detail("llm-basics").sections().getFirst();
        jdbc.update("UPDATE knowledge_sections SET status='DRAFT' WHERE id=?", directory.id());
        var visible = learning.detail("llm-basics").sections();
        assertEquals(39, visible.size());
        assertFalse(visible.stream().anyMatch(s -> s.id() == directory.id() || Long.valueOf(directory.id()).equals(s.parentId())));
        jdbc.update("UPDATE learning_modules SET status='DRAFT' WHERE id=1");
        assertThrows(ResponseStatusException.class, () -> learning.detail("llm-basics"));
    }
    @Test void unknownPointIsNotFound() {
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> learning.detail("missing")).getStatusCode().value());
    }
}
