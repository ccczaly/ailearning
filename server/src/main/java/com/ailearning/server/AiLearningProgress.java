package com.ailearning.server;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only projection of the same published/ancestor-visible lessons as the reading page. */
@Service
public class AiLearningProgress {
    private final JdbcTemplate jdbc;
    private final LearningController learning;
    private final LearningModuleController modules;

    public AiLearningProgress(JdbcTemplate jdbc, LearningController learning, LearningModuleController modules) {
        this.jdbc=jdbc; this.learning=learning; this.modules=modules;
    }

    record Visit(long sectionId, String status, Timestamp accessedAt) {}
    public record ReadingPosition(String module, String courseSlug, long sectionId, String sectionTitle, String url) {}
    public record ModuleProgress(String module, String courseSlug, int totalLessons, int completedLessons,
                                 int visitedLessons, ReadingPosition lastVisited) {}
    public record Snapshot(String scope, String queriedAt, int totalLessons, int completedLessons,
                           int visitedLessons, ReadingPosition lastVisited, List<ModuleProgress> modules, ReadingPosition nextLesson) {
        public Snapshot(String scope, String queriedAt, int totalLessons, int completedLessons,
                        int visitedLessons, ReadingPosition lastVisited, List<ModuleProgress> modules) {
            this(scope, queriedAt, totalLessons, completedLessons, visitedLessons, lastVisited, modules, null);
        }
    }

    @Transactional(readOnly=true)
    public Snapshot read(long userId) {
        var visits=jdbc.query("""
            SELECT section_id,status,last_accessed_at FROM user_section_progress
            WHERE user_id=? ORDER BY last_accessed_at DESC,section_id DESC
            """,(rs,n) -> new Visit(rs.getLong(1),rs.getString(2),rs.getTimestamp(3)),userId);
        var progress=new HashMap<Long,Visit>();
        visits.forEach(visit -> progress.put(visit.sectionId(),visit));
        var results=new ArrayList<ModuleProgress>();
        var positions=new HashMap<Long,ReadingPosition>();
        int total=0,completed=0,visited=0;
        ReadingPosition firstIncomplete=null, resume=null;
        Visit resumeVisit=null;
        for(var module:modules.list()) {
            if(module.entrySlug()==null) continue;
            var lessons=learning.detail(module.entrySlug()).sections().stream()
                .filter(section -> section.nodeType().equals("LESSON")).toList();
            int done=0,seen=0;
            Visit latest=null;
            ReadingPosition position=null;
            for(var lesson:lessons) {
                Visit visit=progress.get(lesson.id());
                var location=new ReadingPosition(module.title(),module.entrySlug(),lesson.id(),lesson.title(),
                    "/knowledge/"+module.entrySlug()+"?section="+lesson.id());
                if(visit==null || !visit.status().equals("COMPLETED")) {
                    if(firstIncomplete==null) firstIncomplete=location;
                    if(visit!=null && (resumeVisit==null || visit.accessedAt().after(resumeVisit.accessedAt()) ||
                        (visit.accessedAt().equals(resumeVisit.accessedAt()) && visit.sectionId()>resumeVisit.sectionId()))) {
                        resume=location; resumeVisit=visit;
                    }
                }
                if(visit==null) continue;
                seen++;
                if(visit.status().equals("COMPLETED")) done++;
                positions.put(lesson.id(),location);
                if(latest==null || visit.accessedAt().after(latest.accessedAt()) ||
                    (visit.accessedAt().equals(latest.accessedAt()) && visit.sectionId()>latest.sectionId())) {
                    latest=visit; position=location;
                }
            }
            results.add(new ModuleProgress(module.title(),module.entrySlug(),lessons.size(),done,seen,position));
            total+=lessons.size(); completed+=done; visited+=seen;
        }
        var latest=visits.stream().map(visit -> positions.get(visit.sectionId())).filter(java.util.Objects::nonNull).findFirst().orElse(null);
        return new Snapshot("current_account",Instant.now().toString(),total,completed,visited,latest,List.copyOf(results),resume!=null ? resume : firstIncomplete);
    }
}
