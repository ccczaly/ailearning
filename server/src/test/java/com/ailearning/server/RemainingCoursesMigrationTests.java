package com.ailearning.server;

import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.junit.jupiter.api.Assertions.*;

class RemainingCoursesMigrationTests {
    @Test void publishingSevenModulesPreservesExistingCoursesAndUserRecords() {
        try(var source=new SingleConnectionDataSource("jdbc:h2:mem:remaining-modules;MODE=MySQL","sa","",true)) {
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("18").load().migrate();
            var jdbc=new JdbcTemplate(source);
            jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES('previous-student','test','Student',TRUE)");
            long user=jdbc.queryForObject("SELECT id FROM app_users WHERE username='previous-student'",Long.class);
            long lesson=jdbc.queryForObject("SELECT MIN(id) FROM knowledge_sections WHERE node_type='LESSON' AND status='PUBLISHED'",Long.class);
            jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status,completed_at) VALUES(?,?,'COMPLETED',CURRENT_TIMESTAMP(3))",user,lesson);
            jdbc.update("INSERT INTO quiz_attempts(user_id,section_id,quiz_version,score,total,passed) VALUES(?,?,1,3,3,TRUE)",user,lesson);
            var tables=List.of("app_users","app_user_roles","user_section_progress","quiz_attempts","quiz_answers","ai_conversations","ai_messages");
            var before=new HashMap<String,Object>();
            for(String table:tables) before.put(table,jdbc.queryForList("SELECT * FROM "+table));
            var oldSections=jdbc.queryForList("SELECT * FROM knowledge_sections ORDER BY id");
            var oldQuestions=jdbc.queryForList("SELECT * FROM lesson_quiz_questions ORDER BY section_id,question_id");
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("19").load().migrate();
            for(String table:tables) assertEquals(before.get(table),jdbc.queryForList("SELECT * FROM "+table));
            assertEquals(oldSections,jdbc.queryForList("SELECT s.* FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug IN ('llm-basics','llm-app-dev') ORDER BY s.id"));
            assertEquals(oldQuestions,jdbc.queryForList("SELECT q.* FROM lesson_quiz_questions q JOIN knowledge_sections s ON s.id=q.section_id JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='llm-app-dev' ORDER BY q.section_id,q.question_id"));
            assertEquals(9,jdbc.queryForObject("SELECT COUNT(*) FROM knowledge_points WHERE status='PUBLISHED'",Integer.class));
            assertEquals(204,jdbc.queryForObject("SELECT COUNT(*) FROM lesson_quiz_questions",Integer.class));
        }
    }
}
