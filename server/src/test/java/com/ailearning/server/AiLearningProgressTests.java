package com.ailearning.server;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ai.tool.execution.ToolExecutionException;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@Transactional
class AiLearningProgressTests {
    @Autowired AiLearningProgress progress;
    @Autowired LearningController learning;
    @Autowired LearningProgressController existing;
    @Autowired JdbcTemplate jdbc;
    long account() {
        String name="tool-progress-"+UUID.randomUUID();
        jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,'test','Student',TRUE)",name);
        return jdbc.queryForObject("SELECT id FROM app_users WHERE username=?",Long.class,name);
    }
    long lesson(String slug,int index) {
        return learning.detail(slug).sections().stream().filter(s -> s.nodeType().equals("LESSON")).toList().get(index).id();
    }
    void visit(long user,long section,boolean completed,String time) {
        jdbc.update("INSERT INTO user_section_progress(user_id,section_id,status,completed_at,last_accessed_at) VALUES(?,?,?,CASE WHEN ? THEN CURRENT_TIMESTAMP(3) ELSE NULL END,?)",
            user,section,completed ? "COMPLETED" : "IN_PROGRESS",completed,java.sql.Timestamp.valueOf(time));
    }
    @Test void noRecordsMeansZeroCompletionAndNoInventedReadingPosition() {
        var result=progress.read(account());
        assertEquals(96,result.totalLessons());
        assertEquals(0,result.completedLessons()); assertEquals(0,result.visitedLessons());
        assertEquals(9,result.modules().size()); assertNull(result.lastVisited());
        assertNotNull(result.nextLesson());
        assertEquals(lesson(result.modules().getFirst().courseSlug(),0),result.nextLesson().sectionId());
        assertTrue(result.modules().stream().allMatch(m -> m.completedLessons()==0 && m.lastVisited()==null));
    }
    @Test void summaryMatchesReadingPageAndExcludesOtherAccountsAndHiddenLessons() {
        long mine=account(),other=account();
        long first=lesson("rag",0),second=lesson("rag",1),hidden=lesson("rag",2);
        visit(mine,first,true,"2026-01-01 10:00:00");
        visit(mine,second,false,"2026-01-01 11:00:00");
        visit(mine,hidden,true,"2026-01-01 12:00:00");
        visit(other,lesson("agents",0),true,"2026-01-02 12:00:00");
        var parent=learning.detail("rag").sections().stream().filter(s -> s.id()==hidden).findFirst().orElseThrow().parentId();
        jdbc.update("UPDATE knowledge_sections SET status='DRAFT' WHERE id=?",parent);
        var result=progress.read(mine);
        assertEquals(94,result.totalLessons()); assertEquals(1,result.completedLessons()); assertEquals(2,result.visitedLessons());
        assertEquals(second,result.lastVisited().sectionId());
        assertEquals(second,result.nextLesson().sectionId());
        var tool=new AiProgressTool(mine,progress);
        assertTrue(tool.actions().isEmpty());
        tool.call("{}");
        assertEquals(java.util.List.of(new AiAction("continue_learning","继续学习","/knowledge/rag?section="+second)),tool.actions());
        assertEquals("/knowledge/rag?section="+second,result.lastVisited().url());
        for(var module:result.modules()) {
            var expected=existing.read(module.courseSlug(),mine);
            assertEquals(expected.total(),module.totalLessons());
            assertEquals(expected.completed(),module.completedLessons());
            assertEquals(expected.sections().size(),module.visitedLessons());
        }
        jdbc.update("UPDATE learning_modules SET status='DRAFT' WHERE code='rag'");
        result=progress.read(mine);
        assertEquals(0,result.completedLessons()); assertEquals(0,result.visitedLessons()); assertNull(result.lastVisited());
    }
    @Test void completedLessonsFallBackToFirstIncompleteAndAllCompletedOffersReview() {
        long user=account();
        var initial=progress.read(user);
        long first=initial.nextLesson().sectionId();
        visit(user,first,true,"2026-01-01 10:00:00");
        assertNotEquals(first,progress.read(user).nextLesson().sectionId());
        for(var module:initial.modules()) {
            for(var section:learning.detail(module.courseSlug()).sections()) {
                if(section.nodeType().equals("LESSON") && section.id()!=first)
                    visit(user,section.id(),true,"2026-01-01 11:00:00");
            }
        }
        assertNull(progress.read(user).nextLesson());
        var tool=new AiProgressTool(user,progress);
        tool.call("{}");
        assertEquals("review_course",tool.actions().getFirst().type());
    }
    @Test void toolIgnoresModelFieldsAndDoesNotLeakIdentifiersOrWriteProgress() throws Exception {
        long user=account();
        var query=mock(AiLearningProgress.class);
        var tool=new AiProgressTool(user,query);
        for(String arguments:new String[]{"[]","123","\"text\"","bad"})
            assertThrows(ToolExecutionException.class,() -> tool.call(arguments));
        verifyNoInteractions(query);
        for(String arguments:new String[]{"{}","null","", "{\"userId\":2}","{\"username\":\"admin\"}","{\"completed\":true}","{\"courseSlug\":\"rag\"}"}) {
            var snapshot=new ObjectMapper().readTree(new AiProgressTool(user,progress).call(arguments));
            assertEquals(0,snapshot.get("completedLessons").intValue());
            assertEquals("current_account",snapshot.get("scope").asString());
        }
        String result=new AiProgressTool(user,progress).call("{}");
        var value=new ObjectMapper().readTree(result);
        assertEquals("current_account",value.get("scope").asString());
        assertFalse(result.contains("userId")); assertFalse(result.contains("username")); assertFalse(result.contains("password"));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM user_section_progress WHERE user_id=?",Integer.class,user));
    }
    @Test void perRequestToolsKeepConcurrentAccountBindingsSeparate() {
        long first=account(),second=account();
        visit(first,lesson("rag",0),true,"2026-01-01 10:00:00");
        var a=new AiProgressTool(first,progress);
        var b=new AiProgressTool(second,progress);
        var json=new ObjectMapper();
        assertEquals(1,json.readTree(a.call("{\"userId\":"+second+",\"completed\":false}")).get("completedLessons").intValue());
        assertEquals(0,json.readTree(b.call("{\"userId\":"+first+",\"completed\":true}")).get("completedLessons").intValue());
        assertEquals(1,json.readTree(a.call("{\"userId\":"+second+",\"completed\":false}")).get("completedLessons").intValue());
    }
}
