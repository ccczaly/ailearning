package com.ailearning.server;

import java.util.List;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.ai.timeout-seconds=1")
@AutoConfigureMockMvc
class AiIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AiRepository repository;
    @Autowired LearningController learning;
    @MockitoBean ChatModel model;
    @MockitoSpyBean AiService ai;
    @MockitoSpyBean UserMemoryService memories;
    @MockitoSpyBean AiLearningProgress progressQuery;
    String username;
    long userId;

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM ai_messages");
        jdbc.update("DELETE FROM ai_conversations");
        username = createUser();
        userId = jdbc.queryForObject("SELECT id FROM app_users WHERE username=?", Long.class, username);
        reset(model);
        // Memory extraction is tested separately; these assertions count answer-model calls.
        doNothing().when(memories).extract(anyLong(),anyString(),any(),any());
        when(model.getOptions()).thenReturn(ToolCallingChatOptions.builder().build());
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(chunk("你好，先从一个例子开始。")));
    }

    String createUser() {
        String name = "ai-test-" + UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,'test-only','AI Test',TRUE)", name);
        jdbc.update("INSERT INTO app_user_roles(user_id,role_id) SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name='USER'", name);
        return name;
    }

    static ChatResponse chunk(String text) { return new ChatResponse(List.of(new Generation(new AssistantMessage(text)))); }
    static ChatResponse progressCall(String id,String arguments) {
        return new ChatResponse(List.of(new Generation(AssistantMessage.builder().content("")
            .toolCalls(List.of(new AssistantMessage.ToolCall(id,"function",AiProgressTool.NAME,arguments))).build())));
    }

    MvcResult start(String body) throws Exception {
        return mvc.perform(post("/api/ai/chat").with(user(username).roles("USER")).with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
    }

    MvcResult finish(MvcResult result) throws Exception {
        assertTrue(result.getRequest().isAsyncStarted());
        result.getAsyncResult(5_000);
        return mvc.perform(asyncDispatch(result)).andExpect(status().isOk()).andReturn();
    }

    long latestConversation() { return jdbc.queryForObject("SELECT MAX(id) FROM ai_conversations", Long.class); }
    long lessonId() { return learning.detail("llm-basics").sections().stream().filter(s -> s.nodeType().equals("LESSON")).findFirst().orElseThrow().id(); }

    @Test void memoryIsIncludedForNewConversationsAndFailureDoesNotBreakChat() throws Exception {
        var memory=memories.get(userId);
        memories.save(userId,new UserMemoryService.Memory(true,"小陈","Java后端","企业知识库","先举例",memory.version(),0));
        finish(start("{\"message\":\"怎么学习RAG\"}"));
        var capture=ArgumentCaptor.forClass(Prompt.class);
        verify(model).stream(capture.capture());
        assertTrue(capture.getValue().getContents().contains("Java后端"));
        assertTrue(capture.getValue().getContents().contains("当前用户要求优先"));
        clearInvocations(model);
        doThrow(new org.springframework.dao.DataAccessResourceFailureException("offline")).when(memories).get(userId);
        finish(start("{\"message\":\"你好\"}"));
        verify(model).stream(any(Prompt.class));
    }

    @Test void modelCanCallProgressToolAndFollowUpUsesFreshCurrentAccountData() throws Exception {
        var snapshots=new ArrayList<tools.jackson.databind.JsonNode>();
        when(model.stream(any(Prompt.class))).thenAnswer(invocation -> {
            Prompt prompt=invocation.getArgument(0);
            var response=prompt.getInstructions().stream().filter(ToolResponseMessage.class::isInstance)
                .map(ToolResponseMessage.class::cast).findFirst();
            if(response.isEmpty()) {
                var options=(ToolCallingChatOptions)prompt.getOptions();
                assertEquals(1,options.getToolCallbacks().size());
                assertEquals(AiProgressTool.NAME,options.getToolCallbacks().getFirst().getToolDefinition().name());
                return Flux.just(progressCall("progress-1","{}"));
            }
            var snapshot=new tools.jackson.databind.ObjectMapper().readTree(response.get().getResponses().getFirst().responseData());
            snapshots.add(snapshot);
            return Flux.just(chunk("已完成 "+snapshot.get("completedLessons").intValue()+" 节，已访问 "+snapshot.get("visitedLessons").intValue()+" 节。"));
        });
        long section=lessonId();
        jdbc.update("INSERT INTO user_section_progress(user_id,section_id) VALUES(?,?)",userId,section);
        String other=createUser();
        jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status,completed_at) SELECT id,?,'COMPLETED',CURRENT_TIMESTAMP(3) FROM app_users WHERE username=?",section,other);
        String first=finish(start("{\"message\":\"我的学习进度怎么样？\"}")).getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(first.contains("已完成 0 节"),first);
        var expectedAction=new AiAction("continue_learning","继续学习",snapshots.getFirst().get("nextLesson").get("url").asString());
        assertTrue(first.contains("\"actions\":[{\"type\":\"continue_learning\""),first);
        var saved=repository.messages(latestConversation()).getLast();
        assertEquals(List.of(expectedAction),saved.actions());
        assertFalse(saved.content().contains("[继续学习"));
        var historyResponse=mvc.perform(get("/api/ai/conversations/"+latestConversation()+"/messages").with(user(username)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(historyResponse.contains("continue_learning"),historyResponse);
        assertEquals(1,snapshots.getFirst().get("visitedLessons").intValue());
        long conversation=latestConversation();
        jdbc.update("UPDATE user_section_progress SET status='COMPLETED',completed_at=CURRENT_TIMESTAMP(3) WHERE user_id=? AND section_id=?",userId,section);
        String second=finish(start("{\"message\":\"现在呢？\",\"conversationId\":"+conversation+"}")).getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(second.contains("已完成 1 节"),second);
        assertEquals(2,snapshots.size());
        assertEquals(section,snapshots.getLast().get("lastVisited").get("sectionId").longValue());
        verify(progressQuery,times(2)).read(userId);
        verify(model,times(4)).stream(any(Prompt.class));
        assertEquals(List.of("user","assistant","user","assistant"),repository.messages(conversation).stream().map(AiRepository.Message::role).toList());
    }

    @Test void regularExplanationsDoNotQueryProgress() throws Exception {
        finish(start("{\"message\":\"解释 Token\"}"));
        verify(progressQuery,never()).read(anyLong());
        assertTrue(repository.messages(latestConversation()).getLast().actions().isEmpty());
        verify(model).stream(any(Prompt.class));
    }

    @Test void extraToolFieldsCannotChangeAccountOrWriteProgress() throws Exception {
        when(model.stream(any(Prompt.class))).thenReturn(
            Flux.just(progressCall("extra-fields","{\"userId\":999,\"completed\":true,\"courseSlug\":\"rag\"}")),
            Flux.just(chunk("当前账号的学习进度。")));
        String body=finish(start("{\"message\":\"查询学习进度\"}")).getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertFalse(body.contains("AI_TOOL_ARGUMENTS_INVALID"));
        assertTrue(body.contains("event:done"));
        assertTrue(body.contains("继续学习"));
        verify(progressQuery).read(userId);
        verify(progressQuery,never()).read(999L);
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM user_section_progress WHERE user_id=?",Integer.class,userId));
        assertEquals("COMPLETED",repository.messages(latestConversation()).getLast().status());
    }

    @Test void malformedToolJsonReportsParameterErrorWithoutReadingProgress() throws Exception {
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(progressCall("invalid-json","bad")));
        String body=finish(start("{\"message\":\"查询学习进度\"}")).getResponse().getContentAsString();
        assertTrue(body.contains("AI_TOOL_ARGUMENTS_INVALID"));
        verify(progressQuery,never()).read(anyLong());
    }

    @Test void queryFailureIsSafeAndDoesNotInventZeroProgress() throws Exception {
        doThrow(new IllegalStateException("jdbc-password-private-record")).when(progressQuery).read(userId);
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(progressCall("failure","{}")));
        String body=finish(start("{\"message\":\"查进度\"}")).getResponse().getContentAsString();
        assertTrue(body.contains("AI_PROGRESS_UNAVAILABLE"));
        assertFalse(body.contains("jdbc-password"));
        assertFalse(body.contains("completedLessons"));
        verify(model).stream(any(Prompt.class));
    }

    @Test void repeatedToolCallsStopAtOneReadWithoutAnUnboundedModelLoop() throws Exception {
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(progressCall("again","{}")));
        String body=finish(start("{\"message\":\"反复查进度\"}")).getResponse().getContentAsString();
        assertTrue(body.contains("AI_TOOL_LIMIT"));
        verify(progressQuery).read(userId);
        verify(model,times(2)).stream(any(Prompt.class));
    }

    @Test void allRemainingModulesProvideTheirOwnLessonContext() throws Exception {
        var slugs=List.of("engineering-basics","rag","agents","mcp","multimodal","app-engineering","deployment");
        var titles=new ArrayList<String>();
        for(String slug:slugs) {
            var section=learning.detail(slug).sections().stream().filter(s -> s.nodeType().equals("LESSON")).findFirst().orElseThrow();
            titles.add(section.title());
            finish(start("{\"message\":\"解释本节\",\"sectionId\":"+section.id()+"}"));
        }
        var prompts=ArgumentCaptor.forClass(Prompt.class);
        verify(model,times(7)).stream(prompts.capture());
        for(int i=0;i<titles.size();i++) assertTrue(prompts.getAllValues().get(i).getContents().contains(titles.get(i)));
    }

    @Test void requiresAuthenticationAndCsrf() throws Exception {
        mvc.perform(get("/api/ai/conversations")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ai/chat").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"message\":\"你好\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/ai/chat").with(user(username).roles("USER"))
            .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"你好\"}"))
            .andExpect(status().isForbidden());
        verify(model, never()).stream(any(Prompt.class));
    }

    @Test void streamsAndPersistsScopedConversation() throws Exception {
        long section = lessonId();
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(chunk("你好，"), chunk("这是课程示例。")));
        String body = finish(start("{\"message\":\"解释当前课程\",\"sectionId\":" + section + "}")).getResponse().getContentAsString();
        assertTrue(body.contains("event:meta"));
        assertTrue(body.contains("\"sectionId\":" + section));
        assertTrue(body.contains("event:delta"));
        assertTrue(body.contains("event:done"));
        assertTrue(body.contains("COMPLETED"));
        long id = latestConversation();
        var messages = repository.messages(id);
        assertEquals(List.of("user", "assistant"), messages.stream().map(AiRepository.Message::role).toList());
        assertEquals("你好，这是课程示例。", messages.getLast().content());
        assertEquals("COMPLETED", messages.getLast().status());
        mvc.perform(get("/api/ai/conversations").with(user(username).roles("USER")))
            .andExpect(content().json("[]"));
        mvc.perform(get("/api/ai/conversations").param("sectionId", String.valueOf(section)).with(user(username).roles("USER")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(get("/api/ai/conversations/" + id + "/messages").with(user(username).roles("USER")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[1].content").value("你好，这是课程示例。"));
        var prompt = ArgumentCaptor.forClass(Prompt.class);
        verify(model).stream(prompt.capture());
        assertTrue(prompt.getValue().getContents().contains(learning.detail("llm-basics").sections().stream()
            .filter(s -> s.id() == section).findFirst().orElseThrow().title()));
    }

    @Test void ownerAndScopeAreCheckedBeforeAnyProviderCall() throws Exception {
        finish(start("{\"message\":\"你好\"}"));
        long conversation = latestConversation();
        clearInvocations(model);
        String other = createUser();
        mvc.perform(get("/api/ai/conversations/" + conversation + "/messages").with(user(other).roles("USER")))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("AI_CONVERSATION_NOT_FOUND"));
        mvc.perform(post("/api/ai/chat").with(user(other).roles("USER")).with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"message\":\"继续\",\"conversationId\":" + conversation + "}"))
            .andExpect(status().isNotFound());
        MvcResult wrongScope = start("{\"message\":\"继续\",\"conversationId\":" + conversation + ",\"sectionId\":" + lessonId() + "}");
        assertEquals(400, wrongScope.getResponse().getStatus());
        assertTrue(wrongScope.getResponse().getContentAsString().contains("AI_CONVERSATION_SCOPE_MISMATCH"));
        verify(model, never()).stream(any(Prompt.class));
    }

    @Test void draftAncestorAndModuleCannotSupplyLessonContext() throws Exception {
        var section = learning.detail("llm-basics").sections().stream().filter(s -> s.nodeType().equals("LESSON")).findFirst().orElseThrow();
        jdbc.update("UPDATE knowledge_sections SET status='DRAFT' WHERE id=?", section.parentId());
        try {
            assertEquals(404, start("{\"message\":\"解释\",\"sectionId\":" + section.id() + "}").getResponse().getStatus());
            mvc.perform(get("/api/ai/conversations").param("sectionId", String.valueOf(section.id())).with(user(username).roles("USER")))
                .andExpect(status().isNotFound());
        } finally { jdbc.update("UPDATE knowledge_sections SET status='PUBLISHED' WHERE id=?", section.parentId()); }
        jdbc.update("UPDATE learning_modules SET status='DRAFT' WHERE code='llm-basics'");
        try { assertEquals(404, start("{\"message\":\"解释\",\"sectionId\":" + section.id() + "}").getResponse().getStatus()); }
        finally { jdbc.update("UPDATE learning_modules SET status='PUBLISHED' WHERE code='llm-basics'"); }
        verify(model, never()).stream(any(Prompt.class));
    }

    @Test void rejectsOversizedInputAndBoundsHistoryAndCourseContext() throws Exception {
        assertEquals(400, start("{\"message\":\"" + "x".repeat(1_001) + "\"}").getResponse().getStatus());
        assertEquals(400, start("{\"message\":\"   \"}").getResponse().getStatus());
        long section = lessonId();
        var first = repository.start(userId, section, null, "old-history-should-disappear");
        repository.finish(first, "old-answer", "COMPLETED");
        for (int i = 0; i < 3; i++) {
            var next = repository.start(userId, section, first.conversationId(), "question-" + i + "x".repeat(6_000));
            repository.finish(next, "answer-" + i + "y".repeat(6_000), "COMPLETED");
        }
        var failed = repository.start(userId, section, first.conversationId(), "failed-turn-marker");
        repository.finish(failed, "failed-answer-marker", "FAILED");
        var cancelled = repository.start(userId, section, first.conversationId(), "cancelled-turn-marker");
        repository.finish(cancelled, "cancelled-answer-marker", "CANCELLED");
        var history = repository.history(first.conversationId(), 4);
        assertEquals(4, history.size());
        assertFalse(history.stream().anyMatch(m -> m.content().contains("failed") || m.content().contains("cancelled")));
        String original = jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?", String.class, section);
        jdbc.update("UPDATE knowledge_sections SET content_markdown=? WHERE id=?", "course-context-" + "c".repeat(20_000), section);
        try {
            finish(start("{\"message\":\"new-question\",\"sectionId\":" + section + ",\"conversationId\":" + first.conversationId() + "}"));
        } finally { jdbc.update("UPDATE knowledge_sections SET content_markdown=? WHERE id=?", original, section); }
        var capture = ArgumentCaptor.forClass(Prompt.class);
        verify(model).stream(capture.capture());
        var prompt = capture.getValue();
        assertEquals("new-question", prompt.getLastUserOrToolResponseMessage().getText());
        assertFalse(prompt.getContents().contains("old-history"));
        assertFalse(prompt.getContents().contains("failed-turn"));
        assertFalse(prompt.getContents().contains("cancelled-turn"));
        int contextChars = prompt.getInstructions().stream().filter(m -> m.getMessageType() != MessageType.SYSTEM)
            .mapToInt(m -> m.getText().length()).sum() - "new-question".length();
        assertTrue(contextChars <= 6_000, "Course and history share the 6000-character context budget");
        assertTrue(prompt.getInstructions().size() <= 7);
    }

    @Test void providerFailurePersistsPartialTextAndNeverLeaksRawError() throws Exception {
        when(model.stream(any(Prompt.class))).thenReturn(Flux.concat(Flux.just(chunk("部分回答")),
            Flux.error(new IllegalStateException("401 provider-secret-sk-test-do-not-expose"))));
        String body = finish(start("{\"message\":\"你好\"}")).getResponse().getContentAsString();
        assertTrue(body.contains("AI_CREDENTIALS_INVALID"));
        assertFalse(body.contains("provider-secret"));
        assertFalse(body.contains("IllegalStateException"));
        long conversation = latestConversation();
        var assistant = repository.messages(conversation).getLast();
        assertEquals("FAILED", assistant.status());
        assertEquals("部分回答", assistant.content());
        assertTrue(repository.history(conversation, 4).isEmpty());
        when(model.stream(any(Prompt.class))).thenReturn(Flux.just(chunk("恢复后的回答")));
        finish(start("{\"message\":\"再试一次\",\"conversationId\":" + conversation + "}"));
        assertEquals("COMPLETED", repository.messages(conversation).getLast().status());
    }

    @Test void completionCallbackCancelsUpstreamAndPersistsPartialAnswer() throws Exception {
        var emitter = mock(SseEmitter.class);
        var completion = new AtomicReference<Runnable>();
        doAnswer(invocation -> { completion.set(invocation.getArgument(0)); return null; }).when(emitter).onCompletion(any());
        doReturn(emitter).when(ai).createEmitter();
        var subscribed = new CountDownLatch(1);
        var cancelled = new CountDownLatch(1);
        when(model.stream(any(Prompt.class))).thenReturn(Flux.concat(Flux.just(chunk("部分")), Flux.never())
            .doOnSubscribe(ignored -> subscribed.countDown()).doOnCancel(cancelled::countDown));
        ai.chat(userId, new AiController.ChatRequest("取消测试", null, null));
        assertTrue(subscribed.await(1, TimeUnit.SECONDS));
        completion.get().run();
        assertTrue(cancelled.await(1, TimeUnit.SECONDS));
        completion.get().run();
        assertEquals("CANCELLED", repository.messages(latestConversation()).getLast().status());
    }

    @Test void absoluteDeadlineCancelsSilentModel() throws Exception {
        var cancelled = new CountDownLatch(1);
        when(model.stream(any(Prompt.class))).thenReturn(Flux.<ChatResponse>never().doOnCancel(cancelled::countDown));
        String body = finish(start("{\"message\":\"等待回答\"}")).getResponse().getContentAsString();
        assertTrue(body.contains("AI_TIMEOUT"));
        assertTrue(cancelled.await(1, TimeUnit.SECONDS));
        assertEquals("FAILED", repository.messages(latestConversation()).getLast().status());
    }

    @Test void allowsMultipleActiveRequestsForTheSameUser() throws Exception {
        var emitter = mock(SseEmitter.class);
        var completions = new java.util.ArrayList<Runnable>();
        doAnswer(invocation -> { completions.add(invocation.getArgument(0)); return null; })
            .when(emitter).onCompletion(any());
        doReturn(emitter).when(ai).createEmitter();
        var subscribed = new CountDownLatch(3);
        when(model.stream(any(Prompt.class))).thenReturn(Flux.<ChatResponse>never()
            .doOnSubscribe(ignored -> subscribed.countDown()));
        try {
            for (int i = 0; i < 3; i++)
                ai.chat(userId, new AiController.ChatRequest("并发测试 " + i, null, null));
            assertTrue(subscribed.await(1, TimeUnit.SECONDS));
            verify(model, times(3)).stream(any(Prompt.class));
        } finally {
            completions.forEach(Runnable::run);
        }
    }

    @Test void restartMarksUnfinishedAnswerAsCancelledAndExcludesItsTurn() {
        var turn = repository.start(userId, null, null, "重启前的问题");
        repository.interruptUnfinishedStreams();
        assertEquals("CANCELLED", repository.messages(turn.conversationId()).getLast().status());
        assertTrue(repository.history(turn.conversationId(), 4).isEmpty());
    }

    @Test void safelyMapsProviderCodes() {
        assertEquals("AI_BALANCE_INSUFFICIENT", AiService.errorCode(new RuntimeException(
            new HttpClientErrorException(HttpStatus.PAYMENT_REQUIRED, "untrusted response"))));
        assertEquals("AI_PROVIDER_BUSY", AiService.errorCode(new IllegalStateException("HTTP 429 body-secret")));
        assertEquals("AI_TIMEOUT", AiService.errorCode(new RuntimeException(new java.net.SocketTimeoutException("key-secret"))));
        assertEquals("AI_UNAVAILABLE", AiService.errorCode(new IllegalArgumentException("key-secret")));
    }

}

