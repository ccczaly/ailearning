package com.ailearning.server;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.junit.jupiter.api.Assertions.*;

class RemoveExplorationMigrationTests {
    @Test void removesExplorationTablesAndPreservesOtherData() {
        try (var source = new SingleConnectionDataSource("jdbc:h2:mem:remove-exploration;MODE=MySQL", "sa", "", true)) {
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("16").load().migrate();
            var jdbc = new JdbcTemplate(source);
            jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES('migration-user','test','Learner',TRUE)");
            long user = jdbc.queryForObject("SELECT id FROM app_users WHERE username='migration-user'", Long.class);
            jdbc.update("INSERT INTO historical_explorations(user_id,chapter_key,version,scheme,initial_reason) VALUES(?,'1950',2,'dialogue','')", user);
            jdbc.update("INSERT INTO historical_reflections(exploration_id,judgment,explanation,strength,improvement,passed,review_status,rubric_version,model_name,rubric_snapshot) SELECT id,'test','','','',TRUE,'test',1,'test','{}' FROM historical_explorations");
            var tables = java.util.List.of("app_users", "knowledge_sections", "quiz_attempts", "quiz_answers", "user_section_progress");
            var before = new java.util.HashMap<String, Object>();
            for (String table : tables) before.put(table, jdbc.queryForList("SELECT * FROM " + table));
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("17").load().migrate();
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('HISTORICAL_EXPLORATIONS','HISTORICAL_REFLECTIONS')", Integer.class));
            for (String table : tables) assertEquals(before.get(table), jdbc.queryForList("SELECT * FROM " + table));
        }
    }
}
