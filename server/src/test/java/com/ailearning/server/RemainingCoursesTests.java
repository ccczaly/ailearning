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
class RemainingCoursesTests {
    static final List<String> SLUGS=List.of("engineering-basics","rag","agents","mcp","multimodal","app-engineering","deployment");
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired LearningController learning;
    String account() {
        String name="curriculum-"+UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,'test','Learner',TRUE)",name);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name='USER'",name);
        return name;
    }
    List<LearningController.Section> lessons(String slug) {
        return learning.detail(slug).sections().stream().filter(s -> s.nodeType().equals("LESSON")).toList();
    }
    String path(String slug,long id) { return "/api/learning/quizzes/"+slug+"/sections/"+id; }
    String answers(long id) throws Exception {
        var answers=new LinkedHashMap<String,Integer>();
        var rows=jdbc.queryForList("SELECT question_id,correct_option FROM lesson_quiz_questions WHERE section_id=? ORDER BY sort_order",id);
        for(int index=0;index<rows.size();index++) {
            var row=rows.get(index);int correct=((Number)row.get("correct_option")).intValue();
            answers.put((String)row.get("question_id"),index==0 ? (correct+1)%3 : correct);
        }
        return new ObjectMapper().writeValueAsString(Map.of("version",1,"answers",answers));
    }
    @Test void allModulesExposeStructuredReadableContentAndQuizMetadata() throws Exception {
        String user=account();
        for(String slug:SLUGS) {
            var point=learning.detail(slug);
            assertEquals(48,point.estimatedMinutes());
            assertEquals(12,point.sections().size());
            for(int chapter=0;chapter<4;chapter++) {
                var directory=point.sections().get(chapter*3);
                assertEquals("DIRECTORY",directory.nodeType());
                assertFalse(directory.hasQuiz());
                for(int index=1;index<=2;index++) {
                    var lesson=point.sections().get(chapter*3+index);
                    assertEquals(directory.id(),lesson.parentId());
                    assertTrue(lesson.hasQuiz());
                    assertTrue(lesson.contentMarkdown().contains("~~~flow"));
                    assertTrue(lesson.contentMarkdown().contains("## 留下的启发"));
                    assertTrue(lesson.contentMarkdown().contains("## 延伸阅读"));
                    assertTrue(lesson.contentMarkdown().contains("```python"));
                }
            }
            mvc.perform(get("/api/knowledge/"+slug).with(user(user))).andExpect(status().isOk())
                .andExpect(jsonPath("$.sections[1].hasQuiz").value(true)).andExpect(jsonPath("$.sections[1].questions").doesNotExist());
        }
    }
    @Test void all56LessonsGradeAndStoreIndependentProgressWithPrivateHistory() throws Exception {
        String name=account(),other=account();
        for(String slug:SLUGS) {
            for(var lesson:lessons(slug)) {
                mvc.perform(get(path(slug,lesson.id())).with(user(name))).andExpect(status().isOk())
                    .andExpect(jsonPath("$.questions.length()").value(3)).andExpect(jsonPath("$.questions[0].answer").doesNotExist());
                mvc.perform(post(path(slug,lesson.id())+"/attempts").with(user(name)).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(answers(lesson.id())))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.score").value(2)).andExpect(jsonPath("$.passed").value(true))
                    .andExpect(jsonPath("$.answers[0].explanation").isNotEmpty());
                mvc.perform(get(path(slug,lesson.id())+"/attempts").with(user(other)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
            }
            mvc.perform(get("/api/learning/progress/"+slug).with(user(name)))
                .andExpect(jsonPath("$.completed").value(8)).andExpect(jsonPath("$.total").value(8));
        }
        mvc.perform(get("/api/learning/progress/llm-basics").with(user(name))).andExpect(jsonPath("$.completed").value(0));
        mvc.perform(get("/api/learning/progress/llm-app-dev").with(user(name))).andExpect(jsonPath("$.completed").value(0));
    }
    @Test void everyModuleRejectsHiddenContentCrossCourseIdsAndUnprotectedWrites() throws Exception {
        String name=account();
        for(String slug:SLUGS) {
            var lesson=lessons(slug).getFirst();
            mvc.perform(get(path(slug,lesson.id()))).andExpect(status().isUnauthorized());
            mvc.perform(post(path(slug,lesson.id())+"/attempts").with(user(name))
                .contentType(MediaType.APPLICATION_JSON).content(answers(lesson.id()))).andExpect(status().isForbidden());
            mvc.perform(post(path(slug,lesson.id())+"/attempts").with(user(name)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1,\"answers\":{}}"))
                .andExpect(status().isBadRequest());
            mvc.perform(get(path("llm-app-dev",lesson.id())).with(user(name))).andExpect(status().isNotFound());
            jdbc.update("UPDATE knowledge_sections SET status='DRAFT' WHERE id=?",lesson.parentId());
            mvc.perform(get(path(slug,lesson.id())).with(user(name))).andExpect(status().isNotFound());
            mvc.perform(get("/api/learning/progress/"+slug).with(user(name))).andExpect(jsonPath("$.total").value(6));
        }
    }
}
