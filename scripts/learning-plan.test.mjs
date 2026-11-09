import test from 'node:test';
import assert from 'node:assert/strict';
import { schedulePlan, moduleOrder, validSchedule } from '../src/learning-plan.ts';

const preferences = { goal: 'agent', level: 'beginner', minutes: 30, days: [1, 3] };
const lesson = { id: 1, slug: 'agents', title: '工具调用', module: 'Agent', minutes: 75, completed: false };
test('排程仅使用所选学习日，拆分长课节并遵守每日预算', () => {
  const tasks = schedulePlan([lesson], preferences, '2026-11-02');
  assert.deepEqual(tasks.map(item => [item.date, item.duration]), [['2026-11-02', 30], ['2026-11-04', 30], ['2026-11-09', 15]]);
  assert.deepEqual(tasks.map(item => [item.part, item.parts]), [[1, 3], [2, 3], [3, 3]]);
  assert.equal(tasks.reduce((sum, item) => sum + item.duration, 0), 75);
});
test('排除已完成课节，并使用当日剩余时间接续下一节', () => {
  const tasks = schedulePlan([{ ...lesson, completed: true }, { ...lesson, id: 2, minutes: 20 }, { ...lesson, id: 3, minutes: 20 }], preferences, '2026-11-03');
  assert.deepEqual(tasks.map(item => [item.id, item.date, item.duration]), [[2, '2026-11-04', 20], [3, '2026-11-04', 10], [3, '2026-11-09', 10]]);
});
test('全部完成或未选择学习日时没有待办', () => {
  assert.deepEqual(schedulePlan([{ ...lesson, completed: true }], preferences, '2026-11-02'), []);
  assert.deepEqual(schedulePlan([lesson], { ...preferences, days: [] }, '2026-11-02'), []);
});
test('基础和学习目标决定课程路径', () => {
  assert.deepEqual(moduleOrder(preferences), ['engineering-basics', 'llm-app-dev', 'agents']);
  assert.deepEqual(moduleOrder({ ...preferences, goal: 'rag', level: 'familiar' }), ['llm-app-dev', 'rag']);
});

test('支持一分钟及超过一小时的任意整数预算', () => {
  const minuteTasks = schedulePlan([{ ...lesson, minutes: 3 }], { ...preferences, minutes: 1 }, '2026-11-02');
  assert.deepEqual(minuteTasks.map(item => item.duration), [1, 1, 1]);
  const longTasks = schedulePlan([lesson], { ...preferences, minutes: 127 }, '2026-11-02');
  assert.deepEqual(longTasks.map(item => [item.date, item.duration]), [['2026-11-02', 75]]);
});

test('具体日期的多个时段按分钟排课，保留中间休息', () => {
  const schedule = [
    { date: '2026-11-09', weekday: 1, slots: [{ startTime: '09:17', endTime: '09:37' }, { startTime: '14:00', endTime: '14:30' }] },
    { date: '2026-11-10', weekday: 2, slots: [{ startTime: '16:00', endTime: '16:25' }] },
  ];
  const tasks = schedulePlan([lesson], { ...preferences, schedule }, '2026-11-09');
  assert.deepEqual(tasks.map(task => [task.date, task.startMinute, task.endMinute, task.duration]),
    [['2026-11-09', 557, 577, 20], ['2026-11-09', 840, 870, 30], ['2026-11-10', 960, 985, 25]]);
});
test('时段不足不向未设置日期排课，校验星期、重复日期和重叠', () => {
  const day = { date: '2026-11-09', weekday: 1, slots: [{ startTime: '23:59', endTime: '24:00' }] };
  assert.equal(schedulePlan([lesson], { ...preferences, schedule: [day] }, day.date).reduce((n,t) => n+t.duration,0), 1);
  assert.equal(validSchedule([{ ...day, weekday: 2 }]), false);
  assert.equal(validSchedule([day, day]), false);
  assert.equal(validSchedule([{ ...day, slots: [{ startTime: '10:00', endTime: '11:00' }, { startTime: '10:30', endTime: '12:00' }] }]), false);
  assert.equal(validSchedule([{ ...day, slots: [] }]), true);
});

 test('全部课程包含所有模块且不重复', () => {
  assert.deepEqual(moduleOrder({ goal: 'all', level: 'beginner' }), ['engineering-basics', 'llm-basics', 'llm-app-dev', 'agents', 'rag']);
});
