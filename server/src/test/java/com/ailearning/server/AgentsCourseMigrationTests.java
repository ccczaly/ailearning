package com.ailearning.server;

import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.junit.jupiter.api.Assertions.*;

class AgentsCourseMigrationTests {
    @Test void replacementPreservesLessonIdentityProgressAndHistoricalAnswers() throws Exception {
        try(var source=new SingleConnectionDataSource("jdbc:h2:mem:agent-curriculum;MODE=MySQL","sa","",true)) {
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("21").load().migrate();
            var jdbc=new JdbcTemplate(source);
            var oldIds=jdbc.queryForList("SELECT s.id FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' AND s.node_type='LESSON' ORDER BY s.id",Long.class);
            long lesson=oldIds.getFirst();
            jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES('agent-old-reader','test','Reader',TRUE)");
            long user=jdbc.queryForObject("SELECT id FROM app_users WHERE username='agent-old-reader'",Long.class);
            jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status,completed_at) VALUES(?,?,'COMPLETED',CURRENT_TIMESTAMP(3))",user,lesson);
            jdbc.update("INSERT INTO quiz_attempts(user_id,section_id,quiz_version,score,total,passed) VALUES(?,?,1,3,3,TRUE)",user,lesson);
            long attempt=jdbc.queryForObject("SELECT MAX(id) FROM quiz_attempts",Long.class);
            jdbc.update("INSERT INTO quiz_answers VALUES(?,'old-question','old-tag','Old question','[\"A\",\"B\",\"C\"]',0,0,TRUE,'Old explanation')",attempt);
            var snapshots=new HashMap<String,Object>();
            for(String table:List.of("user_section_progress","quiz_attempts","quiz_answers","app_users")) snapshots.put(table,jdbc.queryForList("SELECT * FROM "+table));
            var otherSections=jdbc.queryForList("SELECT s.* FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug<>'agents' ORDER BY s.id");
            var otherQuestions=jdbc.queryForList("SELECT q.* FROM lesson_quiz_questions q JOIN knowledge_sections s ON s.id=q.section_id JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug<>'agents' ORDER BY q.section_id,q.question_id");
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("22").load().migrate();
            for(var entry:snapshots.entrySet()) assertEquals(entry.getValue(),jdbc.queryForList("SELECT * FROM "+entry.getKey()));
            var newIds=jdbc.queryForList("SELECT s.id FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' AND s.node_type='LESSON'",Long.class);
            assertEquals(30,newIds.size());
            assertTrue(newIds.containsAll(oldIds));
            assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM lesson_quiz_questions q JOIN knowledge_sections s ON s.id=q.section_id JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents'",Integer.class));
            assertEquals(otherSections,jdbc.queryForList("SELECT s.* FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug<>'agents' ORDER BY s.id"));
            assertEquals(otherQuestions,jdbc.queryForList("SELECT q.* FROM lesson_quiz_questions q JOIN knowledge_sections s ON s.id=q.section_id JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug<>'agents' ORDER BY q.section_id,q.question_id"));
            assertEquals("1.2 聊天机器人、工作流与 Agent",jdbc.queryForObject("SELECT title FROM knowledge_sections WHERE id=?",String.class,lesson));
            long introId=jdbc.queryForObject("SELECT s.id FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' AND s.title='1.1 从“生成回答”到“完成任务”'",Long.class);
            var unchanged=jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",introId);
            jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status,completed_at) VALUES(?,?,'COMPLETED',CURRENT_TIMESTAMP(3))",user,introId);
            var introProgress=jdbc.queryForList("SELECT * FROM user_section_progress WHERE section_id=?",introId);
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("23").load().migrate();
            assertEquals(unchanged,jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",introId));
            assertEquals(introProgress,jdbc.queryForList("SELECT * FROM user_section_progress WHERE section_id=?",introId));
            assertEquals("1.1 AI 会回答，为什么还需要 Agent？",jdbc.queryForObject("SELECT title FROM knowledge_sections WHERE id=?",String.class,introId));
            assertTrue(jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?",String.class,introId).contains("\"kind\": \"capability\""));
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("24").load().migrate();
            String repaired=jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?",String.class,introId);
            assertTrue(repaired.contains("\\n\\n甲课程"));
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("26").load().migrate();
            String demo=jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?",String.class,introId);
            assertTrue(demo.contains("预设教学示例"));
            assertFalse(demo.contains("partialReport"));
            assertFalse(demo.contains("searchResult"));
            assertFalse(demo.contains("\"choices\""));

            assertEquals(unchanged,jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",introId));
            assertEquals(introProgress,jdbc.queryForList("SELECT * FROM user_section_progress WHERE section_id=?",introId));
            var identities=jdbc.queryForList("SELECT s.id,s.parent_id,s.title,s.sort_order FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' ORDER BY s.id");
            var progressBeforeRewrite=jdbc.queryForList("SELECT * FROM user_section_progress");
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("28").load().migrate();
            assertEquals(identities,jdbc.queryForList("SELECT s.id,s.parent_id,s.title,s.sort_order FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' ORDER BY s.id"));
            assertEquals(progressBeforeRewrite,jdbc.queryForList("SELECT * FROM user_section_progress"));
            for(String table:List.of("quiz_attempts","quiz_answers","app_users")) assertEquals(snapshots.get(table),jdbc.queryForList("SELECT * FROM "+table));
            assertEquals(otherSections,jdbc.queryForList("SELECT s.* FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug<>'agents' ORDER BY s.id"));
            assertEquals(otherQuestions,jdbc.queryForList("SELECT q.* FROM lesson_quiz_questions q JOIN knowledge_sections s ON s.id=q.section_id JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug<>'agents' ORDER BY q.section_id,q.question_id"));
            var beforeAnimation=jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",lesson);
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("29").load().migrate();
            assertEquals(beforeAnimation,jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",lesson));
            assertEquals(progressBeforeRewrite,jdbc.queryForList("SELECT * FROM user_section_progress"));
            assertTrue(jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?",String.class,lesson).contains("\"kind\": \"workflow\""));
            var beforeIntroShowcase=jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",introId);
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("30").load().migrate();
            assertEquals(beforeIntroShowcase,jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",introId));
            assertEquals(identities,jdbc.queryForList("SELECT s.id,s.parent_id,s.title,s.sort_order FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' ORDER BY s.id"));
            assertEquals(progressBeforeRewrite,jdbc.queryForList("SELECT * FROM user_section_progress"));
            for(String table:List.of("quiz_attempts","quiz_answers","app_users")) assertEquals(snapshots.get(table),jdbc.queryForList("SELECT * FROM "+table));
            String showcase=jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?",String.class,introId);
            assertTrue(showcase.contains("\"kind\": \"intro-demo\""));
            assertFalse(showcase.contains("\"kind\": \"capability\""));
            var beforeCodingCase=jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",introId);
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("31").load().migrate();
            assertEquals(beforeCodingCase,jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",introId));
            assertEquals(identities,jdbc.queryForList("SELECT s.id,s.parent_id,s.title,s.sort_order FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' ORDER BY s.id"));
            assertEquals(progressBeforeRewrite,jdbc.queryForList("SELECT * FROM user_section_progress"));
            for(String table:List.of("quiz_attempts","quiz_answers","app_users")) assertEquals(snapshots.get(table),jdbc.queryForList("SELECT * FROM "+table));
            String codingCase=jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?",String.class,introId);
            assertTrue(codingCase.contains("\"kind\": \"intro-demo\""));
            assertTrue(codingCase.contains("购物车总价算错了，帮我修复并补上测试"));
            assertTrue(codingCase.contains("AGENTS.md"));
            assertTrue(codingCase.contains("unittest"));
            assertFalse(codingCase.contains("甲课程"));
            var beforeConversation=jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",introId);
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("32").load().migrate();
            assertEquals(beforeConversation,jdbc.queryForList("SELECT * FROM knowledge_sections WHERE id<>? ORDER BY id",introId));
            assertEquals(identities,jdbc.queryForList("SELECT s.id,s.parent_id,s.title,s.sort_order FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' ORDER BY s.id"));
            assertEquals(progressBeforeRewrite,jdbc.queryForList("SELECT * FROM user_section_progress"));
            for(String table:List.of("quiz_attempts","quiz_answers","app_users")) assertEquals(snapshots.get(table),jdbc.queryForList("SELECT * FROM "+table));
            String conversation=jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?",String.class,introId);
            assertTrue(conversation.startsWith("AI 可以解释一段代码为什么出错"));
            assertTrue(conversation.contains("\"kind\": \"intro-demo\""));
            assertTrue(conversation.contains("购物车修复：Agent 对话与程序执行"));
            assertTrue(conversation.contains("执行结果会改变下一步"));
            assertFalse(conversation.contains("> 购物车总价算错了"));

            // Reorganizing the reading course must not credit new subjects with unrelated old completions.
            var mapper=new tools.jackson.databind.ObjectMapper();
            var legacy=mapper.readTree(java.nio.file.Files.readString(java.nio.file.Path.of("../scripts/agent-course-legacy.json")));
            var authored=mapper.readTree(java.nio.file.Files.readString(java.nio.file.Path.of("../content/agents.json")));
            var idsByKey=new HashMap<String,Long>();
            for(int i=0;i<legacy.get("lessons").size();i++) {
                var old=legacy.get("lessons").get(i);
                idsByKey.put(old.get("key").asString(),jdbc.queryForObject("SELECT s.id FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' AND s.node_type='LESSON' AND s.title=?",Long.class,old.get("title").asString()));
            }
            jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status,completed_at) VALUES(?,?,'COMPLETED',CURRENT_TIMESTAMP(3))",user,idsByKey.get("agent-fit"));
            jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status,completed_at) VALUES(?,?,'COMPLETED',CURRENT_TIMESTAMP(3))",user,idsByKey.get("tool-schema"));
            var readingBeforeReorganization=jdbc.queryForList("SELECT * FROM user_section_progress ORDER BY user_id,section_id");
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("33").load().migrate();
            assertEquals(readingBeforeReorganization,jdbc.queryForList("SELECT * FROM user_section_progress ORDER BY user_id,section_id"));
            for(String table:List.of("quiz_attempts","quiz_answers","app_users")) assertEquals(snapshots.get(table),jdbc.queryForList("SELECT * FROM "+table));
            assertEquals(otherSections,jdbc.queryForList("SELECT s.* FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug<>'agents' ORDER BY s.id"));
            assertEquals(otherQuestions,jdbc.queryForList("SELECT q.* FROM lesson_quiz_questions q JOIN knowledge_sections s ON s.id=q.section_id JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug<>'agents' ORDER BY q.section_id,q.question_id"));
            assertEquals(conversation,jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?",String.class,introId));
            assertEquals(35,jdbc.queryForObject("SELECT COUNT(*) FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' AND s.node_type='LESSON' AND s.status='PUBLISHED'",Integer.class));
            assertEquals(8,jdbc.queryForObject("SELECT COUNT(*) FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' AND s.node_type='DIRECTORY' AND s.status='PUBLISHED'",Integer.class));
            var activeKeys=new HashSet<String>();
            int added=0;
            for(int chapter=0;chapter<authored.get("chapters").size();chapter++) {
                var current=authored.get("chapters").get(chapter).get("lessons");
                for(int i=0;i<current.size();i++) {
                    String key=current.get(i).get("key").asString();
                    activeKeys.add(key);
                    long currentId=jdbc.queryForObject("SELECT s.id FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' AND s.node_type='LESSON' AND s.title=? AND s.status='PUBLISHED'",Long.class,current.get(i).get("title").asString());
                    if(idsByKey.containsKey(key)) assertEquals(idsByKey.get(key),currentId);
                    else { assertFalse(idsByKey.containsValue(currentId)); added++; }
                }
            }
            for(var entry:idsByKey.entrySet()) {
                assertEquals(activeKeys.contains(entry.getKey()) ? "PUBLISHED" : "ARCHIVED",jdbc.queryForObject("SELECT status FROM knowledge_sections WHERE id=?",String.class,entry.getValue()));
            }
            assertEquals(30+added,jdbc.queryForObject("SELECT COUNT(*) FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' AND s.node_type='LESSON'",Integer.class));

            // Adding local demonstrations must only update selected published bodies.
            var beforeDemos=jdbc.queryForList("SELECT id,knowledge_point_id,parent_id,node_type,title,estimated_minutes,sort_order,status,created_at FROM knowledge_sections ORDER BY id");
            var beforeDemoProgress=jdbc.queryForList("SELECT * FROM user_section_progress ORDER BY user_id,section_id");
            var beforeDemoChats=jdbc.queryForList("SELECT * FROM ai_conversations ORDER BY id");
            var beforeDemoMessages=jdbc.queryForList("SELECT * FROM ai_messages ORDER BY id");
            var beforeDemoBodies=jdbc.queryForList("SELECT id,content_markdown FROM knowledge_sections ORDER BY id");
            Flyway.configure().dataSource(source).locations("classpath:db/migration").target("34").load().migrate();
            assertEquals(beforeDemos,jdbc.queryForList("SELECT id,knowledge_point_id,parent_id,node_type,title,estimated_minutes,sort_order,status,created_at FROM knowledge_sections ORDER BY id"));
            assertEquals(beforeDemoProgress,jdbc.queryForList("SELECT * FROM user_section_progress ORDER BY user_id,section_id"));
            assertEquals(beforeDemoChats,jdbc.queryForList("SELECT * FROM ai_conversations ORDER BY id"));
            assertEquals(beforeDemoMessages,jdbc.queryForList("SELECT * FROM ai_messages ORDER BY id"));
            for(String table:List.of("quiz_attempts","quiz_answers","app_users")) assertEquals(snapshots.get(table),jdbc.queryForList("SELECT * FROM "+table));
            assertEquals(conversation,jdbc.queryForObject("SELECT content_markdown FROM knowledge_sections WHERE id=?",String.class,introId));
            var afterDemoBodies=jdbc.queryForList("SELECT id,content_markdown FROM knowledge_sections ORDER BY id");
            int changedBodies=0;
            for(int i=0;i<beforeDemoBodies.size();i++) {
                assertEquals(beforeDemoBodies.get(i).get("id"),afterDemoBodies.get(i).get("id"));
                if(!Objects.equals(beforeDemoBodies.get(i).get("content_markdown"),afterDemoBodies.get(i).get("content_markdown"))) changedBodies++;
            }
            assertEquals(16,changedBodies);
            for(int chapter=0;chapter<authored.get("chapters").size();chapter++) {
                var current=authored.get("chapters").get(chapter).get("lessons");
                for(int i=0;i<current.size();i++) assertEquals(current.get(i).get("body").asString(),
                    jdbc.queryForObject("SELECT s.content_markdown FROM knowledge_sections s JOIN knowledge_points p ON p.id=s.knowledge_point_id WHERE p.slug='agents' AND s.title=? AND s.status='PUBLISHED'",String.class,current.get(i).get("title").asString()));
            }
        }
    }
}
