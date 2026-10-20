package com.ailearning.server;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/learning/progress")
public class LearningProgressController {
    private final JdbcTemplate jdbc;
    private final LearningController learning;
    private final Accounts accounts;
    public LearningProgressController(JdbcTemplate jdbc, LearningController learning, Accounts accounts) {
        this.jdbc = jdbc; this.learning = learning; this.accounts = accounts;
    }
    public record LessonProgress(long sectionId, String status) {}
    public record Progress(String slug, int total, int completed, Long lastSectionId, List<LessonProgress> sections) {}
    public record Change(Boolean completed) {}

    @GetMapping("/{slug}")
    public Progress get(@PathVariable String slug, Authentication authentication) {
        return read(slug, accounts.profile(authentication.getName()).id());
    }

    public Progress read(String slug, long userId) {
        var lessons = learning.detail(slug).sections().stream().filter(s -> s.nodeType().equals("LESSON")).toList();
        var visible = new HashSet<Long>();
        lessons.forEach(s -> visible.add(s.id()));
        var rows = jdbc.query("""
            SELECT section_id,status FROM user_section_progress WHERE user_id=?
            ORDER BY last_accessed_at DESC,section_id DESC
            """, (rs, n) -> new LessonProgress(rs.getLong(1), rs.getString(2)), userId)
            .stream().filter(p -> visible.contains(p.sectionId())).toList();
        return new Progress(slug, lessons.size(), (int) rows.stream().filter(p -> p.status().equals("COMPLETED")).count(),
            rows.isEmpty() ? null : rows.getFirst().sectionId(), rows);
    }

    @PutMapping("/{slug}/sections/{sectionId}")
    @Transactional
    public Progress update(@PathVariable String slug, @PathVariable long sectionId,
            @RequestBody Change change, Authentication authentication) {
        if (change.completed() != null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Completion is managed by quizzes");
        if (learning.detail(slug).sections().stream().noneMatch(s -> s.id() == sectionId && s.nodeType().equals("LESSON")))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        long userId = accounts.profile(authentication.getName()).id();
        // Insert once without overwriting completion when revisiting a lesson.
        jdbc.update("""
            INSERT INTO user_section_progress(user_id,section_id) VALUES(?,?)
            ON DUPLICATE KEY UPDATE last_accessed_at=CURRENT_TIMESTAMP(3)
            """, userId, sectionId);
        return read(slug, userId);
    }
}
