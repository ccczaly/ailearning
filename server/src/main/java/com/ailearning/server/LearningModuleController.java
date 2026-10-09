package com.ailearning.server;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/learning/modules")
public class LearningModuleController {
    private final JdbcTemplate jdbc;
    public LearningModuleController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Module(String code, String title, String description, String entrySlug) {}

    @GetMapping
    public List<Module> list() {
        return jdbc.query("""
            SELECT m.code,m.title,m.description,
              (SELECT p.slug FROM knowledge_points p
               WHERE p.module_id=m.id AND p.status='PUBLISHED'
               ORDER BY p.sort_order,p.id LIMIT 1) AS entry_slug
            FROM learning_modules m WHERE m.status='PUBLISHED' ORDER BY m.sort_order,m.id
            """, (rs, n) -> new Module(rs.getString("code"), rs.getString("title"),
                rs.getString("description"), rs.getString("entry_slug")));
    }
}
