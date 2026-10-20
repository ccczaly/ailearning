package com.ailearning.server;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import reactor.core.publisher.Flux;

/** Disposable H2 + simulated model for browser checks; excluded from production jar. */
public class AiBrowserTestApplication {
    public static void main(String[] args) {
        var app = new SpringApplication(AiLearningServerApplication.class, SimulatedAi.class);
        var context = app.run(
            "--spring.datasource.url=jdbc:h2:mem:ai-browser;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "--spring.datasource.username=sa", "--spring.datasource.password=",
            "--spring.datasource.driver-class-name=org.h2.Driver", "--app.bootstrap.enabled=false",
            "--spring.ai.model.chat=none", "--server.port=18080", "--server.address=127.0.0.1",
            "--server.servlet.session.timeout=30m");
        var jdbc = context.getBean(JdbcTemplate.class);
        String hash = context.getBean(PasswordEncoder.class).encode("browser-test-password");
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,?,?,TRUE)",
            "browser-user", hash, "浏览器测试用户");
        jdbc.update("""
            INSERT INTO app_user_roles(user_id,role_id)
            SELECT u.id,r.id FROM app_users u CROSS JOIN app_roles r WHERE u.username=? AND r.name='USER'
            """, "browser-user");
    }

    @TestConfiguration(proxyBeanMethods = false)
    public static class SimulatedAi {
        @Bean ChatModel browserModel() {
            return new ChatModel() {
                @Override public ChatOptions getOptions() { return ToolCallingChatOptions.builder().build(); }
                @Override public ChatResponse call(Prompt prompt) { return simulatedResponse(prompt); }
                @Override public Flux<ChatResponse> stream(Prompt prompt) {
                    var result=simulatedResponse(prompt);
                    if(result.getResult().getOutput().hasToolCalls()) return Flux.just(result);
                    String answer = result.getResult().getOutput().getText();
                    var chunks = new ArrayList<ChatResponse>();
                    for (int offset = 0; offset < answer.length(); offset += 5)
                        chunks.add(response(answer.substring(offset, Math.min(offset + 5, answer.length()))));
                    return Flux.fromIterable(chunks).delaySubscription(Duration.ofMillis(600))
                        .delayElements(Duration.ofMillis(250));
                }
            };
        }
        private static ChatResponse simulatedResponse(Prompt prompt) {
            var result=prompt.getInstructions().stream().filter(ToolResponseMessage.class::isInstance)
                .map(ToolResponseMessage.class::cast).findFirst();
            if(result.isPresent()) {
                var data=new tools.jackson.databind.ObjectMapper().readTree(result.get().getResponses().getFirst().responseData());
                var text=new StringBuilder("【模拟模型；进度来自当前测试账号的真实记录】\n\n")
                    .append("已完成 **").append(data.get("completedLessons").intValue()).append(" / ")
                    .append(data.get("totalLessons").intValue()).append("** 节，已访问 **")
                    .append(data.get("visitedLessons").intValue()).append("** 节。访问不代表已完成。\n\n");
                var last=data.get("lastVisited");
                if(last.isNull()) text.append("当前还没有阅读记录。\n\n");
                else text.append("最近阅读：[").append(last.get("sectionTitle").asString()).append("](")
                    .append(last.get("url").asString()).append(")。\n\n");
                for(var module:data.get("modules")) text.append("- ").append(module.get("module").asString()).append("：")
                    .append(module.get("completedLessons").intValue()).append(" / ").append(module.get("totalLessons").intValue()).append(" 节\n");
                return response(text.toString());
            }
            String question=prompt.getInstructions().getLast().getText();
            if(question.contains("进度") || question.contains("学到哪里"))
                return new ChatResponse(List.of(new Generation(AssistantMessage.builder().content("")
                    .toolCalls(List.of(new AssistantMessage.ToolCall("browser-progress","function",AiProgressTool.NAME,"{}"))).build())));
            return response(answer(prompt));
        }
        private static String answer(Prompt prompt) {
            String question = prompt.getInstructions().getLast().getText();
            return "这是用于浏览器联调的模拟回答。\n\n你问的是：**" + question
                + "**\n\n学习 AI 时，可以先理解概念，再用一个小例子检验理解。\n\n"
                + "例如，把模型想成根据上下文预测后续文字的系统。输入问题后，它依据已学到的规律逐步生成回答。"
                + "\n\n你也可以继续追问，或在阅读页让我结合当前课节举例。";
        }
        private static ChatResponse response(String text) {
            return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
        }
    }
}
