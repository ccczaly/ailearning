import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutTimeBlocks } from '../src/learning-plan-layout.ts';

function assertContained(blocks, height, gap = 2) {
  for (const [index, block] of blocks.entries()) {
    assert.ok(block.top >= -1e-9, 'event begins within the grid');
    assert.ok(block.top + block.height <= height + 1e-9, 'event ends within the grid');
    if (index) assert.ok(block.top >= blocks[index - 1].top + blocks[index - 1].height + gap - 1e-9, 'events do not overlap');
  }
}

test('adjacent short courses remain readable and distinct', () => {
  const blocks = [{ id: 'a', start: 1140, end: 1143 }, { id: 'b', start: 1143, end: 1148 }, { id: 'c', start: 1148, end: 1150 }];
  const placed = layoutTimeBlocks(blocks, 480);
  assert.deepEqual(placed.map(block => block.id), ['a', 'b', 'c']);
  assert.ok(placed.every(block => block.height >= 22));
  assert.equal(placed[0].top, 330);
  assertContained(placed, 480);
  assert.equal(blocks[0].top, undefined, 'input remains unchanged');
});

test('late short courses shift upward together and stay before the bottom edge', () => {
  const placed = layoutTimeBlocks([{ start: 1430, end: 1435 }, { start: 1435, end: 1440 }], 480);
  assert.ok(placed.every(block => block.height >= 22));
  assert.equal(placed.at(-1).top + placed.at(-1).height, 480);
  assertContained(placed, 480);
});

test('separated ranges retain their time positions and proportional sizes', () => {
  const placed = layoutTimeBlocks([{ start: 540, end: 600 }, { start: 1140, end: 1200 }], 480);
  assert.deepEqual(placed.map(block => [block.top, block.height]), [[30, 30], [330, 30]]);
  assertContained(placed, 480);
});

test('clips visible portions while preserving identity and excluding out-of-axis events', () => {
  const placed = layoutTimeBlocks([
    { id: 'before', start: 400, end: 480 },
    { id: 'first', start: 450, end: 540 },
    { id: 'last', start: 1380, end: 1500 },
    { id: 'after', start: 1440, end: 1500 },
  ], 480);
  assert.deepEqual(placed.map(block => [block.id, block.top, block.height]), [['first', 0, 30], ['last', 450, 30]]);
  assert.equal(placed[0].start, 450, 'actual start time remains available for labels');
  assert.equal(placed[1].end, 1500, 'actual end time remains available for labels');
  assertContained(placed, 480);
});

test('a full-day block and short end block fit without discarding either', () => {
  const placed = layoutTimeBlocks([{ start: 480, end: 1439 }, { start: 1439, end: 1440 }], 480);
  assert.equal(placed.length, 2);
  assert.ok(placed.every(block => block.height >= 22));
  assertContained(placed, 480);
});

test('overfull columns retain every event without overlap or overflow', () => {
  const blocks = Array.from({ length: 30 }, (_, index) => ({ start: 1140 + index, end: 1141 + index }));
  const placed = layoutTimeBlocks(blocks, 100);
  assert.equal(placed.length, 30);
  assertContained(placed, 100, 0);
  assert.deepEqual(layoutTimeBlocks(blocks, 0), []);
});
