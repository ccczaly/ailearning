import type { PlanTask } from './learning-plan';
export const taskKey = (task: PlanTask) => `${task.slug}:${task.id}:${task.part}`;
export function moveTasks(tasks: PlanTask[], keys: string[], date: string, start: number, blockId: string): PlanTask[] {
  const moving = tasks.filter(task => keys.includes(taskKey(task))).sort((a,b) => a.date.localeCompare(b.date) || (a.startMinute ?? 0) - (b.startMinute ?? 0));
  if (!moving.length || moving.some(task => task.completed)) throw new Error('请选择待学小节');
  const duration = moving.reduce((sum, task) => sum + task.duration, 0);
  if (!Number.isInteger(start) || start < 0 || start + duration > 1440) throw new Error('课程不能跨越当天，请调整开始时间');
  if (tasks.some(task => !keys.includes(taskKey(task)) && task.date === date && (task.startMinute ?? 0) < start + duration && (task.endMinute ?? 0) > start)) throw new Error('这个时间已有安排，请选择空闲时段');
  let cursor = start;
  const updates = new Map(moving.map(task => {
    const value = { ...task, date, startMinute: cursor, endMinute: cursor + task.duration, blockId };
    cursor += task.duration;
    return [taskKey(task), value];
  }));
  return tasks.map(task => updates.get(taskKey(task)) ?? task).sort((a,b) => a.date.localeCompare(b.date) || (a.startMinute ?? 0) - (b.startMinute ?? 0));
}
