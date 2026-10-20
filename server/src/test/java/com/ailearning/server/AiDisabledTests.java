package com.ailearning.server;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AiDisabledTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test void appBootsAndReturnsSafeUnavailableCodeWithoutConfiguredModel() throws Exception {
        String username = "ai-disabled-" + UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name) VALUES(?,'test-only','AI Test')", username);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name='USER'", username);
        mvc.perform(post("/api/ai/chat").with(user(username).roles("USER")).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"你好\"}"))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"));
    }
}
