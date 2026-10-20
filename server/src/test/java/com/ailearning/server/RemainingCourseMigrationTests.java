package com.ailearning.server;

import java.util.Collections;
import java.util.LinkedHashMap;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.junit.jupiter.api.Assertions.*;

class RemainingCourseMigrationTests {
    @Test void revisionPreservesAllLessonIdsProgressAndEarlierChapters() {
        try (var dataSource = new SingleConnectionDataSource("jdbc:h2:mem:remaining-course;MODE=MySQL", "sa", "", true)) {
            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("11").load().migrate();
            var jdbc = new JdbcTemplate(dataSource);
            var ids = jdbc.queryForList("SELECT s.id FROM knowledge_sections s JOIN knowledge_sections d ON d.id=s.parent_id JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='llm-basics' AND d.node_type='DIRECTORY' AND d.sort_order>=3 AND s.node_type='LESSON' AND s.status='PUBLISHED' ORDER BY d.sort_order,s.sort_order", Long.class);
            assertEquals(24, ids.size());
            var structure = jdbc.queryForList("SELECT id,knowledge_point_id,parent_id,node_type,sort_order,status,created_at FROM knowledge_sections ORDER BY id");
            String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
            String unchangedSql = "SELECT * FROM knowledge_sections WHERE id NOT IN (" + placeholders + ") ORDER BY id";
            var unchanged = jdbc.queryForList(unchangedSql, ids.toArray());
            var oldContent = new LinkedHashMap<Long, String>();
            for (long id : ids) oldContent.put(id, jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?", String.class, id));
            jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES('remaining-course-learner','test-only','Learner',true)");
            long userId = jdbc.queryForObject("SELECT id FROM app_users WHERE username='remaining-course-learner'", Long.class);
            for (int i = 0; i < ids.size(); i++) {
                String status = i % 2 == 0 ? "COMPLETED" : "IN_PROGRESS";
                jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status,completed_at) VALUES(?,?,?,CASE WHEN ?='COMPLETED' THEN CURRENT_TIMESTAMP(3) ELSE NULL END)", userId, ids.get(i), status, status);
            }
            var progress = jdbc.queryForList("SELECT * FROM user_section_progress WHERE user_id=? ORDER BY section_id", userId);

            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("12").load().migrate();

            assertEquals(structure, jdbc.queryForList("SELECT id,knowledge_point_id,parent_id,node_type,sort_order,status,created_at FROM knowledge_sections ORDER BY id"));
            assertEquals(unchanged, jdbc.queryForList(unchangedSql, ids.toArray()));
            assertEquals(progress, jdbc.queryForList("SELECT * FROM user_section_progress WHERE user_id=? ORDER BY section_id", userId));
            for (long id : ids) {
                String body = jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?", String.class, id);
                assertNotEquals(oldContent.get(id), body, "Every remaining lesson must be revised");
                assertTrue(body.contains("## 留下的启发") && body.contains("## 延伸阅读"));
                assertTrue(body.contains("~~~flow") || body.contains("~~~compare"));
                int minutes = jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_sections WHERE id=?", Integer.class, id);
                assertTrue(minutes >= 3 && minutes <= 5);
            }
            assertEquals(110, jdbc.queryForObject("SELECT estimated_minutes FROM knowledge_points WHERE slug='llm-basics'", Integer.class));
            assertEquals(110, jdbc.queryForObject("SELECT SUM(s.estimated_minutes) FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='llm-basics' AND s.node_type='LESSON' AND s.status='PUBLISHED'", Integer.class));
        }
    }
}
