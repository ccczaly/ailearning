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
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LessonQuizTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired LearningController learning;
    String account() {
        String name="quiz-"+UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,'test','Quiz',TRUE)",name);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name='USER'",name);
        return name;
    }
    List<LearningController.Section> lessons() { return learning.detail("llm-basics").sections().stream().filter(s -> s.nodeType().equals("LESSON")).toList(); }
    String path(long id) { return "/api/learning/quizzes/llm-basics/sections/"+id; }
    String body(LearningController.Section lesson, boolean pass) {
        var entries=LessonQuizController.bank(lesson.title()).stream().map(q -> "\""+q.id()+"\":"+(pass ? q.answer() : (q.answer()+1)%3)).toList();
        return "{\"version\":1,\"answers\":{"+String.join(",",entries)+"}}";
    }
    void submit(String name,LearningController.Section lesson,boolean pass) throws Exception {
        mvc.perform(post(path(lesson.id())+"/attempts").with(user(name)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body(lesson,pass)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.passed").value(pass)).andExpect(jsonPath("$.score").value(pass ? 3 : 0))
            .andExpect(jsonPath("$.answers.length()").value(3));
    }
    @Test void bothLessonsGradePersistSnapshotsAndKeepEarlierPass() throws Exception {
        String name=account();
        for(var lesson: lessons().subList(0,2)) {
            mvc.perform(get(path(lesson.id())).with(user(name))).andExpect(status().isOk())
                .andExpect(jsonPath("$.questions.length()").value(3)).andExpect(jsonPath("$.questions[0].answer").doesNotExist());
            submit(name,lesson,false); submit(name,lesson,true); submit(name,lesson,false);
            mvc.perform(get(path(lesson.id())+"/attempts").with(user(name)))
                .andExpect(jsonPath("$.length()").value(3)).andExpect(jsonPath("$[1].passed").value(true))
                .andExpect(jsonPath("$[1].answers[0].explanation").isNotEmpty());
            mvc.perform(get(path(lesson.id())+"/attempts").with(user(account())))
                .andExpect(jsonPath("$.length()").value(0));
            mvc.perform(put("/api/learning/progress/llm-basics/sections/"+lesson.id()).with(user(name)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}")).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/learning/progress/llm-basics").with(user(name))).andExpect(jsonPath("$.completed").value(2));
        assertEquals(18,jdbc.queryForObject("SELECT COUNT(*) FROM quiz_answers",Integer.class));
    }
    @Test void invalidAnswersHiddenContentAndMissingCsrfCannotCreateAttempts() throws Exception {
        String name=account(); var lesson=lessons().getFirst();
        for(String invalid: List.of("{\"version\":1,\"answers\":{}}",body(lesson,true).replace("\"version\":1","\"version\":2")))
            mvc.perform(post(path(lesson.id())+"/attempts").with(user(name)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
        mvc.perform(post(path(lesson.id())+"/attempts").with(user(name)).contentType(MediaType.APPLICATION_JSON).content(body(lesson,true))).andExpect(status().isForbidden());
        mvc.perform(get(path(lesson.id()))).andExpect(status().isUnauthorized());
        mvc.perform(get(path(lessons().get(2).id())).with(user(name))).andExpect(status().isNotFound());
        jdbc.update("UPDATE knowledge_sections SET status='DRAFT' WHERE id=?",lesson.parentId());
        mvc.perform(post(path(lesson.id())+"/attempts").with(user(name)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body(lesson,true))).andExpect(status().isNotFound());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM quiz_attempts",Integer.class));
    }
    @Test void twoCorrectAnswersPassAndOutOfRangeChoicesAreRejected() throws Exception {
        String name=account(); var lesson=lessons().getFirst();
        var first=LessonQuizController.bank(lesson.title()).getFirst();
        String two=body(lesson,true).replace("\""+first.id()+"\":"+first.answer(),"\""+first.id()+"\":"+((first.answer()+1)%3));
        mvc.perform(post(path(lesson.id())+"/attempts").with(user(name)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(two))
            .andExpect(status().isOk()).andExpect(jsonPath("$.score").value(2)).andExpect(jsonPath("$.passed").value(true));
        String invalid=body(lesson,true).replace("\""+first.id()+"\":"+first.answer(),"\""+first.id()+"\":99");
        mvc.perform(post(path(lesson.id())+"/attempts").with(user(name)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(invalid))
            .andExpect(status().isBadRequest());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM quiz_attempts",Integer.class));
    }
}
