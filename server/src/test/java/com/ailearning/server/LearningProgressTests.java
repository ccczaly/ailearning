package com.ailearning.server;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LearningProgressTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired LearningController learning;
    String account() {
        String name = "progress-" + UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,'test','Progress',TRUE)", name);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name='USER'", name);
        return name;
    }
    void change(String name, long id, String body) throws Exception {
        mvc.perform(put("/api/learning/progress/llm-basics/sections/" + id).with(user(name)).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
    }
    @Test void visitsArePersistentAndManualCompletionIsRejected() throws Exception {
        String name = account();
        long id = learning.detail("llm-basics").sections().stream().filter(s -> s.nodeType().equals("LESSON")).findFirst().orElseThrow().id();
        change(name,id,"{}"); change(name,id,"{}");
        mvc.perform(put("/api/learning/progress/llm-basics/sections/"+id).with(user(name)).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/learning/progress/llm-basics").with(user(name)))
            .andExpect(jsonPath("$.completed").value(0)).andExpect(jsonPath("$.sections.length()").value(1))
            .andExpect(jsonPath("$.lastSectionId").value(id));
        mvc.perform(get("/api/learning/progress/llm-basics").with(user(account())))
            .andExpect(jsonPath("$.sections").isEmpty());
    }

    @Test void hiddenLessonsAndDirectoriesCannotCountAndWritesRequireCsrf() throws Exception {
        String name = account();
        var sections = learning.detail("llm-basics").sections();
        var lesson = sections.stream().filter(s -> s.nodeType().equals("LESSON")).skip(2).findFirst().orElseThrow();
        change(name, lesson.id(), "{}");
        jdbc.update("UPDATE knowledge_sections SET status='DRAFT' WHERE id=?", lesson.parentId());
        mvc.perform(get("/api/learning/progress/llm-basics").with(user(name)))
            .andExpect(jsonPath("$.total").value(26)).andExpect(jsonPath("$.completed").value(0))
            .andExpect(jsonPath("$.sections").isEmpty());
        for (long id : new long[]{lesson.id(), sections.getFirst().id()})
            mvc.perform(put("/api/learning/progress/llm-basics/sections/" + id).with(user(name)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{}" )).andExpect(status().isNotFound());
        mvc.perform(put("/api/learning/progress/llm-basics/sections/" + lesson.id()).with(user(name))
            .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/learning/progress/llm-basics")).andExpect(status().isUnauthorized());
    }
}
