package com.ailearning.server;

import java.util.UUID;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import reactor.core.publisher.Flux;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class UserMemoryTests {
    @Autowired UserMemoryService memories;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @MockitoBean ChatModel model;
    String username;
    long id;
    @BeforeEach void setup() {
        username="memory-"+UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,'test','Memory',TRUE)",username);
        id=jdbc.queryForObject("SELECT id FROM app_users WHERE username=?",Long.class,username);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT ?,id FROM app_roles WHERE name='USER'",id);
        reset(model);
    }
    String update(String key,String value,String evidence) {
        return new tools.jackson.databind.ObjectMapper().writeValueAsString(java.util.Map.of("updates",
            java.util.Map.of(key,java.util.Map.of("value",value,"evidence",evidence))));
    }
    UserMemoryService.Memory edited(UserMemoryService.Memory m, boolean enabled, String name) {
        return new UserMemoryService.Memory(enabled,name,m.technicalBackground(),m.learningGoal(),m.responsePreference(),m.version(),0);
    }
    @Test void extractsOnlySupportedFieldsWithEvidenceAndPreservesOthers() {
        var initial=memories.get(id);
        memories.apply(id,"我主要写Java",initial,update("technicalBackground","Java开发者","我主要写Java"));
        var saved=memories.get(id);
        assertEquals("Java开发者",saved.technicalBackground());
        assertEquals("",saved.learningGoal());
        memories.apply(id,"你好",saved,update("learningGoal","做知识库","想做知识库"));
        assertEquals(saved,memories.get(id));
        memories.apply(id,"你好",saved,update("unknown","test","你好"));
        assertEquals(saved,memories.get(id));
        assertTrue(memories.context(saved).contains("Java开发者"));
    }
    @Test void manualEditsClearAndDisableDefeatPendingAndFutureExtraction() {
        var initial=memories.get(id);
        var manual=memories.save(id,edited(initial,true,"小陈"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
            () -> memories.apply(id,"叫我小王",initial,update("preferredName","小王","叫我小王")));
        memories.apply(id,"叫我小王",manual,update("preferredName","小王","叫我小王"));
        assertEquals("小陈",memories.get(id).preferredName());
        var cleared=memories.clear(id,manual.version());
        memories.apply(id,"我写Java",cleared,update("technicalBackground","Java","我写Java"));
        assertEquals("",memories.get(id).technicalBackground());
        var disabled=memories.save(id,edited(cleared,false,""));
        assertEquals("",memories.context(disabled));
        memories.extract(id,"叫我小王",disabled,model);
        verifyNoInteractions(model);
    }
    @Test void apiIsAccountScopedRequiresCsrfAndRejectsStaleWrites() throws Exception {
        var m=memories.get(id);
        var mapper=new tools.jackson.databind.ObjectMapper();
        mvc.perform(get("/api/me/memory")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/me/memory").with(user(username)).contentType("application/json")
            .content(mapper.writeValueAsString(edited(m,true,"小陈")))).andExpect(status().isForbidden());
        mvc.perform(put("/api/me/memory").with(user(username)).with(csrf()).contentType("application/json")
            .content(mapper.writeValueAsString(edited(m,true,"小陈")))).andExpect(status().isOk());
        mvc.perform(put("/api/me/memory").with(user(username)).with(csrf()).contentType("application/json")
            .content(mapper.writeValueAsString(m))).andExpect(status().isConflict());
        mvc.perform(get("/api/me/memory").with(user(username))).andExpect(status().isOk())
            .andExpect(jsonPath("$.preferredName").value("小陈"));
        String other="memory-other-"+UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,'test','Other',TRUE)",other);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name='USER'",other);
        mvc.perform(get("/api/me/memory?userId="+id).with(user(other))).andExpect(status().isOk())
            .andExpect(jsonPath("$.preferredName").value(""));
        mvc.perform(delete("/api/me/memory?version="+memories.get(id).version()).with(user(username)).with(csrf()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.preferredName").value(""));
    }
    @Test void rejectsSecretsAndOversizedValues() {
        var m=memories.get(id);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->memories.save(id,edited(m,true,"x".repeat(81))));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->memories.save(id,edited(m,true,"password: very-secret")));
        assertEquals(m,memories.get(id));
    }
    @Test void backgroundExtractionUsesModelAndPersistsWithoutBlockingCaller() throws Exception {
        var m=memories.get(id);
        var subscribed=new CountDownLatch(1);
        var release=reactor.core.publisher.Sinks.<ChatResponse>one();
        when(model.stream(any(Prompt.class))).thenReturn(release.asMono().flux().doOnSubscribe(s->subscribed.countDown()));
        memories.extract(id,"以后叫我小陈",m,model);
        assertTrue(subscribed.await(3,TimeUnit.SECONDS));
        assertEquals("",memories.get(id).preferredName());
        release.tryEmitValue(new ChatResponse(List.of(new Generation(new AssistantMessage(update("preferredName","小陈","以后叫我小陈"))))));
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(3);
        while(memories.get(id).version()==m.version() && System.nanoTime()<deadline) Thread.sleep(10);
        assertEquals("小陈",memories.get(id).preferredName());
    }
}
