package com.ailearning.server;
import java.util.List;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class PlanDefaultsTests {
 @Test void defaultsProduceDatedMinuteSlots() {
  var filled=PlanTaskTools.defaults(new PlanTaskTools.Draft(null,null,null),LocalDate.of(2026,11,9));
  assertEquals("all",filled.goal()); assertEquals("beginner",filled.level());
  assertEquals(28,filled.schedule().size()); assertEquals(1,filled.schedule().getFirst().weekday());
  assertEquals("2026-11-09",filled.schedule().getFirst().date());
  assertTrue(AiPlanController.validSchedule(filled.schedule()));
 }
 @Test void preservesDifferentDaysMultipleSlotsAndRest() {
  var schedule=List.of(
   new AiPlanController.StudyDay("2026-11-09",1,List.of(new AiPlanController.Slot("19:15","20:05"),new AiPlanController.Slot("21:10","21:35"))),
   new AiPlanController.StudyDay("2026-11-14",6,List.of(new AiPlanController.Slot("09:20","10:10"))),
   new AiPlanController.StudyDay("2026-11-15",7,List.of()));
  var filled=PlanTaskTools.defaults(new PlanTaskTools.Draft("agent",null,schedule));
  assertEquals(schedule,filled.schedule()); assertTrue(AiPlanController.validSchedule(filled.schedule()));
  assertEquals("ready",PlanTaskTools.inspect(filled).status());
 }
 @Test void onlyTwoMissingCategories() {
  assertEquals(List.of("goal","schedule"),PlanTaskTools.inspect(new PlanTaskTools.Draft(null,null,null)).missingFields());
 }
}
