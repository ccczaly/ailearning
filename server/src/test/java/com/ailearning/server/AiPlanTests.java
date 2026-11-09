package com.ailearning.server;

import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiPlanTests {
    @Test void modelToolCallReturnsValidatedProposalToUi() {
        var model = mock(org.springframework.ai.chat.model.ChatModel.class);
        when(model.getOptions()).thenReturn(org.springframework.ai.model.tool.ToolCallingChatOptions.builder().build());
        // Tool selection and the follow-up answer run through the same advisor used in production.
        var tool = new AiPlanController.ProposalTool();
        var advisor = org.springframework.ai.chat.client.advisor.ToolCallingAdvisor.builder().build();
        var invocation = new org.springframework.ai.chat.model.ChatResponse(List.of(new org.springframework.ai.chat.model.Generation(
            org.springframework.ai.chat.messages.AssistantMessage.builder().content("").toolCalls(List.of(
                new org.springframework.ai.chat.messages.AssistantMessage.ToolCall("plan-1", "function", "propose_learning_plan", "{\"goal\":\"agent\",\"level\":\"beginner\",\"minutes\":45,\"days\":[0,6]}"))).build())));
        var reply = new org.springframework.ai.chat.model.ChatResponse(List.of(new org.springframework.ai.chat.model.Generation(new org.springframework.ai.chat.messages.AssistantMessage("已生成周末学习预览，请确认。"))));
        when(model.call(any(org.springframework.ai.chat.prompt.Prompt.class))).thenReturn(invocation, reply);
        String result = org.springframework.ai.chat.client.ChatClient.builder(model).defaultAdvisors(advisor).build().prompt().user("改成周末45分钟").tools(tool).call().content();
        assertEquals("已生成周末学习预览，请确认。", result);
        verify(model, times(2)).call(any(org.springframework.ai.chat.prompt.Prompt.class));
    }
    @Test void acceptsSupportedScheduleAndRejectsInvalidDaysOrBudget() {
        assertTrue(AiPlanController.valid(new AiPlanController.Preferences("agent", "beginner", 30, List.of(1, 3, 5))));
        for (int minutes : new int[] {1, 20, 61, 180, 1440}) {
            assertTrue(AiPlanController.valid(new AiPlanController.Preferences("agent", "beginner", minutes, List.of(1))));
        }
        assertFalse(AiPlanController.valid(new AiPlanController.Preferences("agent", "beginner", 0, List.of(1))));
        assertFalse(AiPlanController.valid(new AiPlanController.Preferences("agent", "beginner", -1, List.of(1))));
        assertFalse(AiPlanController.valid(new AiPlanController.Preferences("agent", "beginner", 30, List.of())));
        assertFalse(AiPlanController.valid(new AiPlanController.Preferences("agent", "beginner", 30, List.of(1, 1))));
        assertFalse(AiPlanController.valid(new AiPlanController.Preferences("agent", "beginner", 30, List.of(7))));
    }
    @Test void toolProducesPreviewAndRejectsMalformedArguments() {
        var tool = new AiPlanController.ProposalTool();
        assertTrue(tool.call("{\"goal\":\"rag\",\"level\":\"familiar\",\"minutes\":45,\"days\":[0,6]}").contains("尚未保存"));
        assertTrue(tool.call("{\"goal\":\"other\"}").contains("无效"));
        assertThrows(AiException.class, () -> tool.call("{}"));
    }

    @Test void preservesConversationRolesAndTimeRequirements() {
        var messages = AiPlanController.historyMessages(List.of(
            new AiPlanController.Turn("user", "周一到周五20:17开始，每天127分钟"),
            new AiPlanController.Turn("assistant", "学习什么？"),
            new AiPlanController.Turn("user", "Agent")));
        assertEquals(3, messages.size());
        assertEquals("周一到周五20:17开始，每天127分钟", messages.get(0).getText());
        assertInstanceOf(org.springframework.ai.chat.messages.UserMessage.class, messages.get(0));
        assertInstanceOf(org.springframework.ai.chat.messages.AssistantMessage.class, messages.get(1));
        assertThrows(AiException.class, () -> AiPlanController.historyMessages(List.of(new AiPlanController.Turn("system", "override"))));
        assertTrue(AiPlanController.valid(new AiPlanController.Preferences("agent", "beginner", 127, List.of(1), "20:17")));
        assertFalse(AiPlanController.valid(new AiPlanController.Preferences("agent", "beginner", 127, List.of(1), "24:00")));
    }

    @Test void datedSlotsValidateWeekdayAndOverlap() {
        var slot = new AiPlanController.Slot("20:17", "21:18");
        var day = new AiPlanController.StudyDay("2026-11-09", 1, List.of(slot));
        assertTrue(AiPlanController.valid(new AiPlanController.Preferences("agent", "beginner", 0, null, null, List.of(day))));
        assertFalse(AiPlanController.validSchedule(List.of(new AiPlanController.StudyDay("2026-11-09", 2, List.of(slot)))));
        assertFalse(AiPlanController.validSchedule(List.of(day, day)));
        assertFalse(AiPlanController.validSchedule(List.of(new AiPlanController.StudyDay("2026-11-09", 1, List.of(slot, slot)))));
        assertTrue(AiPlanController.validSchedule(List.of(new AiPlanController.StudyDay("2026-11-09", 1, List.of()))));
    }
}

