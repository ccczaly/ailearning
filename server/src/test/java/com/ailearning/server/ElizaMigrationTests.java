package com.ailearning.server;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.junit.jupiter.api.Assertions.*;

class ElizaMigrationTests {
    @Test void revisionPreservesElizaIdsProgressAndAllOtherSections() {
        // Keep the migration's H2 session alive while its CHECK constraints are evaluated.
        try (var dataSource = new SingleConnectionDataSource("jdbc:h2:mem:eliza-revision;MODE=MySQL", "sa", "", true)) {
            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("10").load().migrate();
            var jdbc = new JdbcTemplate(dataSource);
            long firstId = jdbc.queryForObject("SELECT s.id FROM knowledge_sections s JOIN knowledge_sections d ON d.id=s.parent_id JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='llm-basics' AND d.title='1966 · ELIZA 与规则对话' AND s.title='关键词和模板怎样模拟对话' AND s.status='PUBLISHED'", Long.class);
            long secondId = jdbc.queryForObject("SELECT s.id FROM knowledge_sections s JOIN knowledge_sections d ON d.id=s.parent_id JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='llm-basics' AND d.title='1966 · ELIZA 与规则对话' AND s.title='规则的边界：为什么开始从数据学习' AND s.status='PUBLISHED'", Long.class);
            var otherSections = jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id NOT IN (?,?) ORDER BY id", firstId, secondId);
            var layout = jdbc.queryForList("SELECT id,knowledge_point_id,parent_id,node_type,sort_order,status,created_at FROM knowledge_sections WHERE id IN (?,?) ORDER BY id", firstId, secondId);
            jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES('eliza-learner','test-only','Learner',true)");
            long userId = jdbc.queryForObject("SELECT id FROM app_users WHERE username='eliza-learner'", Long.class);
            jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status,completed_at) VALUES(?,?,'COMPLETED',CURRENT_TIMESTAMP(3))", userId, firstId);
            jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status) VALUES(?,?,'IN_PROGRESS')", userId, secondId);
            var progress = jdbc.queryForList("SELECT * FROM user_section_progress WHERE user_id=? ORDER BY section_id", userId);
            assertEquals(385, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_points WHERE slug='llm-basics'", Integer.class));

            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("11").load().migrate();

            assertEquals("1966：ELIZA 怎样接话？", jdbc.queryForObject("SELECT title FROM knowledge_sections WHERE id=?", String.class, firstId));
            assertEquals("规则的边界：接话不等于理解", jdbc.queryForObject("SELECT title FROM knowledge_sections WHERE id=?", String.class, secondId));
            assertEquals(3, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_sections WHERE id=?", Integer.class, firstId));
            assertEquals(3, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_sections WHERE id=?", Integer.class, secondId));
            assertTrue(jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?", String.class, firstId).contains("## ELIZA 怎样生成回复"));
            assertTrue(jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?", String.class, secondId).contains("## 规则为什么会遇到边界"));
            assertEquals(layout, jdbc.queryForList("SELECT id,knowledge_point_id,parent_id,node_type,sort_order,status,created_at FROM knowledge_sections WHERE id IN (?,?) ORDER BY id", firstId, secondId));
            assertEquals(otherSections, jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id NOT IN (?,?) ORDER BY id", firstId, secondId));
            assertEquals(progress, jdbc.queryForList("SELECT * FROM user_section_progress WHERE user_id=? ORDER BY section_id", userId));
            assertEquals(373, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_points WHERE slug='llm-basics'", Integer.class));
            assertEquals(373, jdbc.queryForObject("SELECT SUM(s.estimated_minutes) FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='llm-basics' AND s.node_type='LESSON' AND s.status='PUBLISHED'", Integer.class));
        }
    }
}
