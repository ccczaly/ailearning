package com.ailearning.server;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/knowledge")
public class LearningController {
    private final JdbcTemplate jdbc;
    public LearningController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Section(long id, Long parentId, String nodeType, String title, String contentMarkdown, Integer estimatedMinutes, boolean hasQuiz) {}
    public record Point(long id, String title, String summary, String learningObjectives, Integer estimatedMinutes, String moduleTitle, List<Section> sections) {}

    @GetMapping("/{slug}")
    public Point forUser(@PathVariable String slug) { return detail(slug); }
    public Point detail(String slug) {
        var point = jdbc.query("""
            SELECT p.*, m.title AS module_title FROM knowledge_points p
            JOIN learning_modules m ON m.id=p.module_id
            WHERE p.slug=? AND p.status='PUBLISHED' AND m.status='PUBLISHED'
            """, (rs, n) -> new Point(rs.getLong("id"), rs.getString("title"), rs.getString("summary"),
                rs.getString("learning_objectives"), rs.getObject("estimated_minutes", Integer.class),
                rs.getString("module_title"), List.of()), slug).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        var rows = jdbc.query("""
            SELECT s.*, EXISTS(SELECT 1 FROM lesson_quiz_questions q WHERE q.section_id=s.id) AS has_quiz
            FROM knowledge_sections s WHERE s.knowledge_point_id=? AND s.status='PUBLISHED'
            ORDER BY s.sort_order,s.id
            """, (rs, n) -> new Section(rs.getLong("id"), rs.getObject("parent_id", Long.class),
                rs.getString("node_type"), rs.getString("title"), rs.getString("content_markdown"),
                rs.getObject("estimated_minutes", Integer.class), rs.getBoolean("has_quiz") ||
                    (slug.equals("llm-basics") && !LessonQuizController.bank(rs.getString("title")).isEmpty())), point.id());
        var visible = new ArrayList<Section>();
        appendChildren(rows, null, visible, new HashSet<>());
        return new Point(point.id(), point.title(), point.summary(), point.learningObjectives(),
            point.estimatedMinutes(), point.moduleTitle(), visible);
    }
    private void appendChildren(List<Section> rows, Long parent, List<Section> result, Set<Long> seen) {
        for (var section : rows) {
            if (Objects.equals(section.parentId(), parent) && seen.add(section.id())) {
                result.add(section);
                if (section.nodeType().equals("DIRECTORY")) appendChildren(rows, section.id(), result, seen);
            }
        }
    }
}
