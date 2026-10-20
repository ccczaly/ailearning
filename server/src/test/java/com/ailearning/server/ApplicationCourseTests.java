package com.ailearning.server;

import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ApplicationCourseTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired LearningController learning;
    String account() {
        String name="app-course-"+UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,'test','Learner',TRUE)",name);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name='USER'",name);
        return name;
    }
    List<LearningController.Section> lessons() {
        return learning.detail("llm-app-dev").sections().stream().filter(s -> s.nodeType().equals("LESSON")).toList();
    }
    String path(long id) { return "/api/learning/quizzes/llm-app-dev/sections/"+id; }
    String answers(long id, int wrong) throws Exception {
        var data = new LinkedHashMap<String,Integer>();
        var rows=jdbc.queryForList("SELECT question_id,correct_option FROM lesson_quiz_questions WHERE section_id=? ORDER BY sort_order",id);
        for(int index=0; index<rows.size(); index++) {
            var row=rows.get(index); int correct=((Number)row.get("correct_option")).intValue();
            data.put((String)row.get("question_id"),index<wrong ? (correct+1)%3 : correct);
        }
        return new ObjectMapper().writeValueAsString(Map.of("version",1,"answers",data));
    }
    @Test void completeCourseHasOrderedContentAndEveryLessonHasQuiz() throws Exception {
        var point=learning.forUser("llm-app-dev");
        assertEquals(18,point.sections().size());
        assertEquals(78,point.estimatedMinutes());
        for(int chapter=0; chapter<6; chapter++) {
            var directory=point.sections().get(chapter*3);
            assertEquals("DIRECTORY",directory.nodeType());
            for(int i=1;i<=2;i++) {
                var lesson=point.sections().get(chapter*3+i);
                assertEquals(directory.id(),lesson.parentId());
                assertTrue(lesson.hasQuiz());
                assertTrue(lesson.contentMarkdown().contains("~~~flow"));
                assertTrue(lesson.contentMarkdown().contains("## 延伸阅读"));
                assertTrue(lesson.contentMarkdown().contains("```python"));
            }
        }
        assertEquals(36,jdbc.queryForObject("SELECT COUNT(*) FROM lesson_quiz_questions q JOIN knowledge_sections s ON s.id=q.section_id JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='llm-app-dev'",Integer.class));
        mvc.perform(get("/api/knowledge/llm-app-dev").with(user(account())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.sections[1].hasQuiz").value(true))
            .andExpect(jsonPath("$.sections[1].questions").doesNotExist());
    }
    @Test void allTwelveQuizzesGradeAndPersistProgressAndPrivateHistory() throws Exception {
        String name=account(),other=account();
        for(var lesson:lessons()) {
            mvc.perform(get(path(lesson.id())).with(user(name))).andExpect(status().isOk())
                .andExpect(jsonPath("$.questions.length()").value(3)).andExpect(jsonPath("$.questions[0].answer").doesNotExist());
            mvc.perform(post(path(lesson.id())+"/attempts").with(user(name)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(answers(lesson.id(),1)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.score").value(2)).andExpect(jsonPath("$.passed").value(true))
                .andExpect(jsonPath("$.answers[0].explanation").isNotEmpty());
            mvc.perform(post(path(lesson.id())+"/attempts").with(user(name)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(answers(lesson.id(),3)))
                .andExpect(jsonPath("$.passed").value(false));
            mvc.perform(get(path(lesson.id())+"/attempts").with(user(other)))
                .andExpect(jsonPath("$.length()").value(0));
        }
        mvc.perform(get("/api/learning/progress/llm-app-dev").with(user(name)))
            .andExpect(jsonPath("$.completed").value(12)).andExpect(jsonPath("$.total").value(12));
        mvc.perform(get("/api/learning/progress/llm-basics").with(user(name))).andExpect(jsonPath("$.completed").value(0));
    }
    @Test void courseQuizRespectsVisibilitySlugAuthenticationAndCsrf() throws Exception {
        String name=account(); var lesson=lessons().getFirst();
        mvc.perform(get(path(lesson.id()))).andExpect(status().isUnauthorized());
        mvc.perform(post(path(lesson.id())+"/attempts").with(user(name)).contentType(MediaType.APPLICATION_JSON).content(answers(lesson.id(),0)))
            .andExpect(status().isForbidden());
        mvc.perform(post(path(lesson.id())+"/attempts").with(user(name)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"version\":1,\"answers\":{}}"))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/learning/quizzes/llm-basics/sections/"+lesson.id()).with(user(name))).andExpect(status().isNotFound());
        jdbc.update("UPDATE knowledge_sections SET status='DRAFT' WHERE id=?",lesson.parentId());
        mvc.perform(get(path(lesson.id())).with(user(name))).andExpect(status().isNotFound());
        mvc.perform(get("/api/learning/progress/llm-app-dev").with(user(name))).andExpect(jsonPath("$.total").value(10));
    }
}
