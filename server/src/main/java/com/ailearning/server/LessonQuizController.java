package com.ailearning.server;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/learning/quizzes")
public class LessonQuizController {
    private final JdbcTemplate jdbc;
    private final Accounts accounts;
    private final LearningController learning;
    public LessonQuizController(JdbcTemplate jdbc, Accounts accounts, LearningController learning) {
        this.jdbc=jdbc; this.accounts=accounts; this.learning=learning;
    }
    public record Question(String id, String tag, String text, List<String> options, int answer, String explanation) {}
    public record PublicQuestion(String id, String text, List<String> options) {}
    public record Quiz(int version, int passScore, List<PublicQuestion> questions) {}
    public record Submission(int version, Map<String,Integer> answers) {}
    public record Review(String questionId, String question, List<String> options, int selectedOption, int correctOption, boolean correct, String explanation) {}
    public record Attempt(long id, int version, int score, int total, boolean passed, String submittedAt, List<Review> answers) {}
    static List<Question> bank(String title) {
        return switch(title) {
            case "1950：机器能思考吗？" -> List.of(
                new Question("turing-observation", "可观察的能力", "图灵为什么把讨论转向可观察的语言表现？", List.of("因为机器已经具有人的感受", "因为“思考”的定义难以统一，可以先观察具体表现", "因为文字回答永远不会出错"), 1, "“思考”难以定义。模仿游戏把讨论转向文字问答中可以观察的表现，并不预先证明机器有感受。"),
                new Question("turing-evidence", "评测证据", "机器流畅地回答了一次问题，最合理的判断是什么？", List.of("这是一条能力线索，还需要持续追问", "已经证明它理解所有问题", "已经证明它具有意识"), 0, "一次流畅回答只提供有限证据。继续追问条件与理由，才能观察一致性与能力边界。"),
                new Question("turing-application", "评测设计", "你要评估一个学习助手，哪种做法更符合本节启发？", List.of("只看回复是否足够长", "只看它的头像是否像人", "先说明要观察的能力，再用问题和追问检验"), 2, "先确定能力与观察标准，再设计问题。长度和外貌不能代替对回答表现的检验。"));
            case "模仿游戏：用文字观察机器" -> List.of(
                new Question("game-text", "文字交流", "模仿游戏为什么遮住外貌和声音，使用文字交流？", List.of("减少外表和声音带来的先入判断", "保证机器一定答对", "让提问者不能追问"), 0, "文字交流让观察集中在回答表现上，减少外貌和声音的影响；它不保证回答正确。"),
                new Question("game-followup", "追问与条件", "机器算对一道题后，哪种追问最有助于检验能力？", List.of("你的头像是什么颜色？", "能把同一句答案重复十遍吗？", "如果条件改变，答案和理由会怎样变化？"), 2, "改变条件并要求解释，可以观察机器是否处理了新条件、理由是否一致。"),
                new Question("game-boundary", "表现与理解", "关于“回答得像人”，哪种说法准确？", List.of("只要像人，就证明具有理解和意识", "它是一种表现，是否具有理解仍需进一步讨论", "它完全不能提供任何观察线索"), 1, "模仿游戏提供观察方法。像人的回答是表现证据，并不能直接解决理解或意识的问题。"));
            default -> List.of();
        };
    }
    private List<Question> questions(String slug, long id) {
        var section=learning.detail(slug).sections().stream().filter(s -> s.id()==id && s.nodeType().equals("LESSON")).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        var questions=jdbc.query("SELECT * FROM lesson_quiz_questions WHERE section_id=? ORDER BY sort_order,question_id", (rs,n) -> {
            try {
                var options = new ObjectMapper().readValue(rs.getString("options_json"), new tools.jackson.core.type.TypeReference<List<String>>(){});
                return new Question(rs.getString("question_id"),rs.getString("knowledge_tag"),rs.getString("question_text"),options,rs.getInt("correct_option"),rs.getString("explanation"));
            } catch (Exception e) { throw new IllegalStateException(e); }
        },id);
        if (questions.isEmpty() && slug.equals("llm-basics")) questions=bank(section.title());
        if(questions.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return questions;
    }
    @GetMapping("/{slug}/sections/{id}")
    public Quiz get(@PathVariable String slug, @PathVariable long id, Authentication auth) {
        return new Quiz(1,2,questions(slug,id).stream().map(q -> new PublicQuestion(q.id(),q.text(),q.options())).toList());
    }
    @PostMapping("/{slug}/sections/{id}/attempts")
    @Transactional
    public Attempt submit(@PathVariable String slug, @PathVariable long id, @RequestBody Submission submission, Authentication auth) {
        var questions=questions(slug,id);
        if(submission.version()!=1 || submission.answers()==null || submission.answers().size()!=questions.size())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        for(var q: questions) {
            var selected=submission.answers().get(q.id());
            if(selected==null || selected<0 || selected>=q.options().size()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        long user=accounts.profile(auth.getName()).id();
        int score=(int)questions.stream().filter(q -> submission.answers().get(q.id())==q.answer()).count();
        var key=new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement=connection.prepareStatement("INSERT INTO quiz_attempts(user_id,section_id,quiz_version,score,total,passed) VALUES(?,?,1,?,3,?)", new String[]{"id"});
            statement.setLong(1,user); statement.setLong(2,id); statement.setInt(3,score); statement.setBoolean(4,score>=2); return statement;
        },key);
        long attempt=Objects.requireNonNull(key.getKey()).longValue();
        for(var q: questions) {
            String options;
            try { options=new ObjectMapper().writeValueAsString(q.options()); } catch(Exception e) { throw new IllegalStateException(e); }
            int selected=submission.answers().get(q.id());
            jdbc.update("INSERT INTO quiz_answers VALUES(?,?,?,?,?,?,?,?,?)",attempt,q.id(),q.tag(),q.text(),options,selected,q.answer(),selected==q.answer(),q.explanation());
        }
        jdbc.update("INSERT INTO user_section_progress(user_id,section_id) VALUES(?,?) ON DUPLICATE KEY UPDATE last_accessed_at=CURRENT_TIMESTAMP(3)",user,id);
        if(score>=2) jdbc.update("UPDATE user_section_progress SET status='COMPLETED',completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP(3)) WHERE user_id=? AND section_id=?",user,id);
        return attempt(attempt,user);
    }
    @GetMapping("/{slug}/sections/{id}/attempts")
    public List<Attempt> history(@PathVariable String slug, @PathVariable long id, Authentication auth) {
        questions(slug,id);
        long user=accounts.profile(auth.getName()).id();
        return jdbc.queryForList("SELECT id FROM quiz_attempts WHERE user_id=? AND section_id=? ORDER BY id DESC LIMIT 50",Long.class,user,id)
            .stream().map(a -> attempt(a,user)).toList();
    }
    private Attempt attempt(long id,long user) {
        var reviews=jdbc.query("SELECT * FROM quiz_answers WHERE attempt_id=? ORDER BY question_id",(rs,n) -> {
            List<String> options;
            try { options=new ObjectMapper().readValue(rs.getString("options_snapshot"),new tools.jackson.core.type.TypeReference<List<String>>(){}); }
            catch(Exception e) { throw new IllegalStateException(e); }
            return new Review(rs.getString("question_id"),rs.getString("question_snapshot"),options,rs.getInt("selected_option"),rs.getInt("correct_option"),rs.getBoolean("correct"),rs.getString("explanation_snapshot"));
        },id);
        return jdbc.query("SELECT * FROM quiz_attempts WHERE id=? AND user_id=?",(rs,n) -> new Attempt(id,rs.getInt("quiz_version"),rs.getInt("score"),rs.getInt("total"),rs.getBoolean("passed"),rs.getTimestamp("submitted_at").toInstant().toString(),reviews),id,user).getFirst();
    }
}
