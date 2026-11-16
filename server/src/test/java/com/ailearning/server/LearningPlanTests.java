package com.ailearning.server;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest
@Transactional
class LearningPlanTests {
 @Autowired LearningPlanController controller;
 @Autowired LearningController learning;
 @Autowired JdbcTemplate jdbc;
 @Test void persistsReplacesAndIsolates() {
  String name="plan-"+UUID.randomUUID(), other="plan-"+UUID.randomUUID();
  for(String n:List.of(name,other)) jdbc.update("INSERT INTO app_users(username,password_hash,display_name,enabled) VALUES(?,'test','Plan',TRUE)",n);
  var auth=new UsernamePasswordAuthenticationToken(name,"test");
  var otherAuth=new UsernamePasswordAuthenticationToken(other,"test");
  assertEquals(204,controller.get(auth).getStatusCode().value());
  long id=learning.detail("llm-basics").sections().stream().filter(s -> s.nodeType().equals("LESSON")).findFirst().orElseThrow().id();
  var preferences=new AiPlanController.Preferences("foundation","beginner",30,List.of(5));
  var task=new LearningPlanController.Task(id,"llm-basics","ignored","ignored",20,false,"2026-11-13",30,1,1,1140,1170,"block-test");
  var plan=new LearningPlanController.Plan(1,preferences,"2026-11-13",List.of(task));
  controller.put(plan,auth);
  var restored=controller.get(auth).getBody();
  assertEquals(1140,restored.tasks().getFirst().startMinute());
  assertEquals("block-test",restored.tasks().getFirst().blockId());
  assertNotEquals("ignored",restored.tasks().getFirst().title());
  assertEquals(204,controller.get(otherAuth).getStatusCode().value());
  assertThrows(org.springframework.web.server.ResponseStatusException.class,() -> controller.put(new LearningPlanController.Plan(1,preferences,"invalid",List.of(task)),auth));
  assertEquals(1,controller.get(auth).getBody().tasks().size());
  controller.put(new LearningPlanController.Plan(1,preferences,"2026-11-13",List.of()),auth);
  assertTrue(controller.get(auth).getBody().tasks().isEmpty());
 }
}
