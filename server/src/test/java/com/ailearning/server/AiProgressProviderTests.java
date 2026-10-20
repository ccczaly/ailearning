package com.ailearning.server;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.deepseek.DeepSeekChatModel;
import org.springframework.ai.deepseek.DeepSeekChatOptions;
import org.springframework.ai.deepseek.api.DeepSeekApi;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Exercises the real provider adapter against a loopback SSE fixture, never the paid API. */
class AiProgressProviderTests {
    @ParameterizedTest
    @ValueSource(strings={"{}", "null", "{\"userId\":999,\"courseSlug\":\"rag\",\"completed\":true}"})
    void deepSeekAdapterSendsToolSchemaAndAssemblesFragmentedCallsBeforeFollowUp(String arguments) throws Exception {
        var json=new ObjectMapper();
        var requests=new CopyOnWriteArrayList<tools.jackson.databind.JsonNode>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/",exchange -> {
            try {
                requests.add(json.readTree(exchange.getRequestBody().readAllBytes()));
                String output;
                if(requests.size()==1) {
                    output=event(json,Map.of("tool_calls",List.of(Map.of("index",0,"id","call-1","type","function",
                        "function",Map.of("name",AiProgressTool.NAME,"arguments",arguments.substring(0,1))))),null)
                        +event(json,Map.of("tool_calls",List.of(Map.of("index",0,"function",Map.of("arguments",arguments.substring(1))))),null)
                        +event(json,Map.of(),"tool_calls");
                } else output=event(json,Map.of("content","progress-ok"),"stop");
                byte[] bytes=(output+"data: [DONE]\n\n").getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type","text/event-stream; charset=utf-8");
                exchange.sendResponseHeaders(200,bytes.length);
                exchange.getResponseBody().write(bytes);
            } finally { exchange.close(); }
        });
        server.start();
        try {
            var query=mock(AiLearningProgress.class);
            when(query.read(77L)).thenReturn(new AiLearningProgress.Snapshot("current_account","test-time",96,2,3,null,List.of()));
            var api=DeepSeekApi.builder().baseUrl("http://127.0.0.1:"+server.getAddress().getPort()).apiKey("local-test-only").build();
            var model=DeepSeekChatModel.builder().deepSeekApi(api).options(DeepSeekChatOptions.builder().model("deepseek-flash").build()).build();
            var results=ChatClient.create(model).prompt("查当前账号进度").tools(new AiProgressTool(77L,query))
                .stream().chatResponse().collectList().block(Duration.ofSeconds(10));
            assertNotNull(results);
            assertTrue(results.stream().anyMatch(r -> r.getResult()!=null && "progress-ok".equals(r.getResult().getOutput().getText())));
            assertEquals(2,requests.size());
            assertEquals(AiProgressTool.NAME,requests.getFirst().get("tools").get(0).get("function").get("name").asString());
            var schema=requests.getFirst().get("tools").get(0).get("function").get("parameters");
            assertEquals(0,schema.get("properties").size());
            assertFalse(schema.get("additionalProperties").booleanValue());
            tools.jackson.databind.JsonNode result=null;
            for(var message:requests.getLast().get("messages"))
                if("tool".equals(message.get("role").asString())) result=json.readTree(message.get("content").asString());
            assertNotNull(result); assertEquals(2,result.get("completedLessons").intValue());
            assertFalse(result.toString().contains("userId"));
            verify(query,never()).read(999L);
            verify(query).read(77L);
        } finally { server.stop(0); }
    }

    private static String event(ObjectMapper json,Map<String,Object> delta,String finish) {
        var choice=new java.util.LinkedHashMap<String,Object>();
        choice.put("index",0); choice.put("delta",delta); choice.put("finish_reason",finish);
        return "data: "+json.writeValueAsString(Map.of("id","local-stream","object","chat.completion.chunk","created",1,
            "model","deepseek-flash","choices",List.of(choice)))+"\n\n";
    }
}
