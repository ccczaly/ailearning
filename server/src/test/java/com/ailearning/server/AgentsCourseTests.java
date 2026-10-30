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
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AgentsCourseTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired LearningController learning;

    String account() {
        String name="agent-reader-"+UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,'test','Reader',TRUE)",name);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name='USER'",name);
        return name;
    }
    String path(long id) { return "/api/learning/progress/agents/sections/"+id; }

    @Test void publishesProgressiveReadingCourseWithPreservedIntroAndReferenceDemos() throws Exception {
        var point=learning.detail("agents");
        var authored=new tools.jackson.databind.ObjectMapper().readTree(java.nio.file.Files.readString(java.nio.file.Path.of("../content/agents.json")));
        assertEquals(8,authored.get("chapters").size());
        assertEquals(43,point.sections().size());
        int row=0, minutes=0, lessons=0, references=0;
        for(int chapter=0;chapter<authored.get("chapters").size();chapter++) {
            var sourceChapter=authored.get("chapters").get(chapter);
            var directory=point.sections().get(row++);
            assertEquals("DIRECTORY",directory.nodeType());
            assertEquals(sourceChapter.get("title").asString(),directory.title());
            for(int index=0;index<sourceChapter.get("lessons").size();index++) {
                var source=sourceChapter.get("lessons").get(index);
                var lesson=point.sections().get(row++);
                assertEquals(directory.id(),lesson.parentId());
                assertEquals(source.get("title").asString(),lesson.title());
                assertEquals(source.get("body").asString(),lesson.contentMarkdown());
                assertEquals(source.get("minutes").asInt(),lesson.estimatedMinutes());
                assertFalse(lesson.hasQuiz());
                minutes+=lesson.estimatedMinutes();
                lessons++;
                if(chapter==0 && index==0) {
                    assertTrue(lesson.contentMarkdown().contains("\"kind\": \"intro-demo\""));
                    assertTrue(lesson.contentMarkdown().contains("购物车修复：Agent 对话与程序执行"));
                    assertTrue(lesson.contentMarkdown().contains("执行结果会改变下一步"));
                } else {
                    if(lesson.contentMarkdown().contains("~~~agent")) {
                        assertTrue(lesson.contentMarkdown().contains("\"kind\": \"reference-demo\""));
                        assertTrue(lesson.contentMarkdown().contains("## 交互演示"));
                        assertTrue(lesson.contentMarkdown().indexOf("## 交互演示") < lesson.contentMarkdown().indexOf("## 深入阅读"));
                        references++;
                    }
                    assertTrue(lesson.contentMarkdown().contains("## 深入阅读"));
                    assertFalse(lesson.contentMarkdown().contains("## 动手验证："));
                    assertFalse(lesson.contentMarkdown().contains("## 换个任务，试着解释"));
                }
            }
        }
        assertEquals(35,lessons);
        assertEquals(16,references);
        assertEquals(minutes,point.estimatedMinutes());
        mvc.perform(get("/api/knowledge/agents").with(user(account())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.sections[1].hasQuiz").value(false));
        long first=point.sections().get(1).id();
        mvc.perform(get("/api/learning/quizzes/agents/sections/"+first).with(user(account()))).andExpect(status().isNotFound());
    }

    @Test void readingIsExplicitPersistentAndAccountScoped() throws Exception {
        String reader=account(), other=account();
        long id=learning.detail("agents").sections().get(1).id();
        mvc.perform(put(path(id)).with(user(reader)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(0));
        mvc.perform(put(path(id)).with(user(reader)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(35)).andExpect(jsonPath("$.completed").value(1));
        mvc.perform(put(path(id)).with(user(reader)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(1));
        mvc.perform(get("/api/learning/progress/agents").with(user(other)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(0)).andExpect(jsonPath("$.sections").isEmpty());
        mvc.perform(put(path(id)).with(user(reader)).contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
            .andExpect(status().isForbidden());
        mvc.perform(put(path(id)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
            .andExpect(status().isUnauthorized());
        long foreign=learning.detail("rag").sections().get(1).id();
        mvc.perform(put(path(foreign)).with(user(reader)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
            .andExpect(status().isNotFound());
        mvc.perform(put(path(learning.detail("agents").sections().getFirst().id())).with(user(reader)).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}")).andExpect(status().isNotFound());
        jdbc.update("UPDATE knowledge_sections SET status='DRAFT' WHERE id=?",id);
        mvc.perform(put(path(id)).with(user(reader)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"completed\":true}"))
            .andExpect(status().isNotFound());
    }
}
