type SectionChoice = { id: number };

function key(userId: number, slug: string) { return `ailearning.reading.section:${userId}:${encodeURIComponent(slug)}`; }
function validId(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

// Remember a view location only. Completion and learning progress remain server concerns.
export function rememberReadingSection(userId: number | undefined, slug: string, sectionId: number) {
  if (!userId || !Number.isSafeInteger(sectionId) || sectionId <= 0) return;
  try { globalThis.localStorage?.setItem(key(userId, slug), String(sectionId)); }
  catch { /* Reading and URL navigation still work when browser storage is unavailable. */ }
}

export function restoreReadingSection(userId: number | undefined, slug: string, sections: SectionChoice[], query: unknown) {
  const requested = validId(query);
  if (requested !== undefined && sections.some(section => section.id === requested)) return requested;
  if (userId) {
    try {
      const stored = validId(globalThis.localStorage?.getItem(key(userId, slug)));
      if (stored !== undefined && sections.some(section => section.id === stored)) return stored;
    } catch { /* Fall back to the first currently available lesson. */ }
  }
  return sections[0]?.id;
}
