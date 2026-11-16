type TimeBlock = { start: number; end: number };

/** Place 08:00–24:00 blocks in a fixed-height grid, keeping short blocks clickable. */
export function layoutTimeBlocks<T extends TimeBlock>(blocks: readonly T[], height: number): (T & { top: number; height: number })[] {
  if (!Number.isFinite(height) || height <= 0) return [];
  const axisStart = 480;
  const axisEnd = 1440;
  const minimum = 22;
  let gap = 2;
  const placed = blocks
    .filter(block => Number.isFinite(block.start) && Number.isFinite(block.end)
      && block.end > block.start && block.end > axisStart && block.start < axisEnd)
    .map(block => ({
      ...block,
      top: (Math.max(axisStart, block.start) - axisStart) / (axisEnd - axisStart) * height,
      height: Math.max(minimum, (Math.min(axisEnd, block.end) - Math.max(axisStart, block.start)) / (axisEnd - axisStart) * height),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (!placed.length) return placed;

  const totalHeight = placed.reduce((sum, block) => sum + block.height, 0);
  const available = height - gap * (placed.length - 1);
  if (totalHeight > available) {
    if (available >= placed.length * minimum) {
      const excessScale = (available - placed.length * minimum) / (totalHeight - placed.length * minimum);
      for (const block of placed) block.height = minimum + (block.height - minimum) * excessScale;
    } else {
      // An overfull column cannot physically keep every block at 22px. Preserve
      // every event and its order, reducing both minimum height and gap to fit.
      const scale = height / (placed.length * minimum + gap * (placed.length - 1));
      gap *= scale;
      for (const block of placed) block.height = minimum * scale;
    }
  }

  let bottom = 0;
  for (const block of placed) {
    block.top = Math.max(block.top, bottom);
    bottom = block.top + block.height + gap;
  }
  // Move only the colliding tail upward when minimum-sized blocks pass 24:00.
  let nextTop = height + gap;
  for (let index = placed.length - 1; index >= 0; index--) {
    const block = placed[index]!;
    block.top = Math.max(0, Math.min(block.top, nextTop - gap - block.height));
    nextTop = block.top;
  }
  return placed;
}
