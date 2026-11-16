package com.ailearning.server;

import java.util.*;
import java.time.LocalDate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/learning/plan")
public class LearningPlanController {
    private final JdbcTemplate jdbc;
    private final Accounts accounts;
    private final LearningController learning;
    private static final ObjectMapper JSON = new ObjectMapper();
    public LearningPlanController(JdbcTemplate jdbc, Accounts accounts, LearningController learning) {
        this.jdbc=jdbc; this.accounts=accounts; this.learning=learning;
    }
    public record Task(long id, String slug, String title, String module, int minutes, boolean completed,
                       String date, int duration, int part, int parts, int startMinute, int endMinute, String blockId) {}
    public record Plan(int version, AiPlanController.Preferences preferences, String started, List<Task> tasks) {}

    @GetMapping
    @Transactional(readOnly=true)
    public org.springframework.http.ResponseEntity<Plan> get(Authentication authentication) {
        var plan=read(accounts.profile(authentication.getName()).id());
        return plan==null ? org.springframework.http.ResponseEntity.noContent().build() : org.springframework.http.ResponseEntity.ok(plan);
    }

    private Plan read(long userId) {
        var plans=jdbc.query("SELECT preferences_json,started FROM learning_plans WHERE user_id=?",
            (rs,n) -> new Plan(1, JSON.readValue(rs.getString(1), AiPlanController.Preferences.class), rs.getString(2), List.of()), userId);
        if(plans.isEmpty()) return null;
        var tasks=jdbc.query("""
            SELECT t.*,s.title,s.estimated_minutes,p.status AS progress_status,k.module_title
            FROM learning_plan_tasks t JOIN knowledge_sections s ON s.id=t.section_id
            JOIN (SELECT p.slug,m.title AS module_title FROM knowledge_points p JOIN learning_modules m ON m.id=p.module_id) k ON k.slug=t.course_slug
            LEFT JOIN user_section_progress p ON p.user_id=t.user_id AND p.section_id=t.section_id
            WHERE t.user_id=? ORDER BY t.task_order
            """, (rs,n) -> new Task(rs.getLong("section_id"),rs.getString("course_slug"),rs.getString("title"),rs.getString("module_title"),
                rs.getInt("estimated_minutes")>0 ? rs.getInt("estimated_minutes") : 20,"COMPLETED".equals(rs.getString("progress_status")),
                rs.getString("study_date"),rs.getInt("end_minute")-rs.getInt("start_minute"),rs.getInt("part"),rs.getInt("parts"),rs.getInt("start_minute"),rs.getInt("end_minute"),rs.getString("block_id")),userId);
        var plan=plans.getFirst();
        return new Plan(1,plan.preferences(),plan.started(),tasks);
    }

    @PutMapping
    @Transactional
    public Plan put(@RequestBody Plan plan, Authentication authentication) {
        validate(plan);
        long userId=accounts.profile(authentication.getName()).id();
        jdbc.update("""
            INSERT INTO learning_plans(user_id,preferences_json,started) VALUES(?,?,?)
            ON DUPLICATE KEY UPDATE preferences_json=VALUES(preferences_json),started=VALUES(started)
            """,userId,JSON.writeValueAsString(plan.preferences()),plan.started());
        jdbc.update("DELETE FROM learning_plan_tasks WHERE user_id=?",userId);
        int order=0;
        for(var task:plan.tasks()) jdbc.update("""
            INSERT INTO learning_plan_tasks(user_id,task_order,section_id,course_slug,study_date,start_minute,end_minute,part,parts,block_id)
            VALUES(?,?,?,?,?,?,?,?,?,?)
            """,userId,order++,task.id(),task.slug(),task.date(),task.startMinute(),task.endMinute(),task.part(),task.parts(),task.blockId());
        return read(userId);
    }

    private void validate(Plan plan) {
        try {
            if(plan==null || plan.version()!=1 || !AiPlanController.valid(plan.preferences()) || plan.tasks()==null || plan.tasks().size()>10000) throw new IllegalArgumentException();
            LocalDate.parse(plan.started());
            var courses=new HashMap<String,LearningController.Point>();
            var sorted=new ArrayList<>(plan.tasks());
            sorted.sort(Comparator.comparing(Task::date).thenComparingInt(Task::startMinute));
            Task previous=null;
            var pieces=new HashMap<Long,List<Task>>();
            for(var task:sorted) {
                LocalDate.parse(task.date());
                if(task.blockId()!=null && task.blockId().length()>80) throw new IllegalArgumentException();
                if(task.startMinute()<0 || task.endMinute()>1440 || task.endMinute()<=task.startMinute() || task.duration()!=task.endMinute()-task.startMinute()
                    || task.part()<1 || task.parts()<task.part()) throw new IllegalArgumentException();
                if(previous!=null && previous.date().equals(task.date()) && previous.endMinute()>task.startMinute()) throw new IllegalArgumentException();
                previous=task;
                var course=courses.computeIfAbsent(task.slug(),learning::detail);
                if(course.sections().stream().noneMatch(s -> s.id()==task.id() && s.nodeType().equals("LESSON"))) throw new IllegalArgumentException();
                pieces.computeIfAbsent(task.id(),key -> new ArrayList<>()).add(task);
            }
            for(var group:pieces.values()) {
                var parts=new HashSet<Integer>();
                for(var task:group) if(task.parts()!=group.size() || !parts.add(task.part())) throw new IllegalArgumentException();
            }
        } catch(RuntimeException invalid) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid learning plan"); }
    }
}
