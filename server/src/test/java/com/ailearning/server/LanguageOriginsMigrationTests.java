package com.ailearning.server;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.junit.jupiter.api.Assertions.*;

class LanguageOriginsMigrationTests {
    @Test void revisionPreservesLessonIdsProgressAndOtherChapters() {
        // Keep the migration's H2 session alive while its CHECK constraints are evaluated.
        try (var dataSource = new SingleConnectionDataSource("jdbc:h2:mem:origins-revision;MODE=MySQL", "sa", "", true)) {
            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("7").load().migrate();
            var jdbc = new JdbcTemplate(dataSource);
            long firstId = jdbc.queryForObject("SELECT id FROM knowledge_sections WHERE title='从智能问题到语言任务' AND status='PUBLISHED'", Long.class);
            long secondId = jdbc.queryForObject("SELECT id FROM knowledge_sections WHERE title='怎样阅读这条技术时间线' AND status='PUBLISHED'", Long.class);
            var otherSections = jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id NOT IN (?,?) ORDER BY id", firstId, secondId);
            jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES('migration-learner','test-only','Learner',true)");
            long userId = jdbc.queryForObject("SELECT id FROM app_users WHERE username='migration-learner'", Long.class);
            jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status,completed_at) VALUES(?,?,'COMPLETED',CURRENT_TIMESTAMP(3))", userId, firstId);
            var progress = jdbc.queryForList("SELECT * FROM user_section_progress WHERE user_id=?", userId);

            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("8").load().migrate();

            assertEquals("它会接话，就算听懂了吗？", jdbc.queryForObject("SELECT title FROM knowledge_sections WHERE id=?", String.class, firstId));
            assertEquals("同一句话，为什么能有不同意思？", jdbc.queryForObject("SELECT title FROM knowledge_sections WHERE id=?", String.class, secondId));
            assertEquals(3, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_sections WHERE id=?", Integer.class, firstId));
            assertEquals(4, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_sections WHERE id=?", Integer.class, secondId));
            assertEquals(otherSections, jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id NOT IN (?,?) ORDER BY id", firstId, secondId));
            assertEquals(progress, jdbc.queryForList("SELECT * FROM user_section_progress WHERE user_id=?", userId));
            assertEquals(386, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_points WHERE slug='llm-basics'", Integer.class));

            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("9").load().migrate();

            assertEquals("1950：图灵问，机器能思考吗？", jdbc.queryForObject("SELECT title FROM knowledge_sections WHERE id=?", String.class, firstId));
            assertEquals("模仿游戏：隔着一堵墙，怎样判断智能？", jdbc.queryForObject("SELECT title FROM knowledge_sections WHERE id=?", String.class, secondId));
            assertEquals(5, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_sections WHERE id=?", Integer.class, firstId));
            assertEquals(5, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_sections WHERE id=?", Integer.class, secondId));
            assertEquals(otherSections, jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id NOT IN (?,?) ORDER BY id", firstId, secondId));
            assertEquals(progress, jdbc.queryForList("SELECT * FROM user_section_progress WHERE user_id=?", userId));
            assertEquals(389, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_points WHERE slug='llm-basics'", Integer.class));

            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("10").load().migrate();

            assertEquals("1950：机器能思考吗？", jdbc.queryForObject("SELECT title FROM knowledge_sections WHERE id=?", String.class, firstId));
            assertEquals("模仿游戏：用文字观察机器", jdbc.queryForObject("SELECT title FROM knowledge_sections WHERE id=?", String.class, secondId));
            assertEquals(3, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_sections WHERE id=?", Integer.class, firstId));
            assertEquals(3, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_sections WHERE id=?", Integer.class, secondId));
            assertEquals(otherSections, jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id NOT IN (?,?) ORDER BY id", firstId, secondId));
            assertEquals(progress, jdbc.queryForList("SELECT * FROM user_section_progress WHERE user_id=?", userId));
            assertEquals(385, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_points WHERE slug='llm-basics'", Integer.class));
        }
    }
}
