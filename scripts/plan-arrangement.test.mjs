import test from 'node:test';
import assert from 'node:assert/strict';
import { moveTasks, taskKey } from '../src/plan-arrangement.ts';
const task = (id, start, duration = 20, extra = {}) => ({ id, slug: 'agents', title: `lesson ${id}`, module: 'Agent', minutes: duration, completed: false, date: '2026-11-13', duration, startMinute: start, endMinute: start + duration, part: 1, parts: 1, ...extra });
test('moves a whole block across dates while keeping sections and lengths', () => {
 const source = [task(1,540),task(2,560),task(3,600)];
 const result = moveTasks(source,source.slice(0,2).map(taskKey),'2026-11-14',600,'merged');
 assert.deepEqual(result.filter(t => t.blockId === 'merged').map(t => [t.id,t.startMinute,t.endMinute]),[[1,600,620],[2,620,640]]);
 assert.equal(source[0].date,'2026-11-13');
 assert.equal(result.find(t => t.id === 3).startMinute,600);
});
test('extracts one section and merges it after another without moving siblings', () => {
 const source = [task(1,540,20,{blockId:'old'}),task(2,560,20,{blockId:'old'}),task(3,600,20,{blockId:'target'})];
 const result = moveTasks(source,[taskKey(source[1])],'2026-11-13',620,'target');
 assert.equal(result.find(t => t.id === 1).blockId,'old');
 assert.deepEqual(result.filter(t => t.blockId === 'target').map(t => t.id),[3,2]);
});
test('rejects overlaps, cross-day moves and completed sections', () => {
 const source = [task(1,540),task(2,600)];
 assert.throws(() => moveTasks(source,[taskKey(source[0])],'2026-11-13',610,'x'),/已有安排/);
 assert.throws(() => moveTasks(source,[taskKey(source[0])],'2026-11-13',1430,'x'),/跨越/);
 assert.throws(() => moveTasks([task(1,540,20,{completed:true})],['agents:1:1'],'2026-11-13',600,'x'),/待学/);
});
