export type StudyDay = { date: string; weekday: number; slots: { startTime: string; endTime: string }[] };
export type Preferences = { goal: string; level: string; minutes: number; days: number[]; startTime?: string; schedule?: StudyDay[] };
export type PlanLesson = { id: number; slug: string; title: string; module: string; minutes: number; completed: boolean };
export type PlanTask = PlanLesson & { date: string; duration: number; part: number; parts: number; startMinute?: number; endMinute?: number };
export type SavedPlan = { version: 1; preferences: Preferences; started: string };
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function schedulePlan(lessons: PlanLesson[], preferences: Preferences, start: string): PlanTask[] {
  if (preferences.schedule) return scheduleDatedPlan(lessons, preferences.schedule);
  if (!preferences.days.length || !Number.isSafeInteger(preferences.minutes) || preferences.minutes < 1) return [];
  const date = new Date(`${start}T12:00:00`);
  const tasks: PlanTask[] = [];
  let remaining = preferences.minutes;
  function nextDay() { date.setDate(date.getDate() + 1); remaining = preferences.minutes; }
  function seekDay() { while (!preferences.days.includes(date.getDay())) nextDay(); }
  seekDay();
  for (const lesson of lessons.filter(item => !item.completed)) {
    let minutes = Math.max(1, lesson.minutes);
    const pieces: PlanTask[] = [];
    while (minutes > 0) {
      if (!remaining) { nextDay(); seekDay(); }
      const duration = Math.min(minutes, remaining);
      pieces.push({ ...lesson, date: dateKey(date), duration, part: pieces.length + 1, parts: 0 });
      minutes -= duration; remaining -= duration;
    }
    pieces.forEach(piece => { piece.parts = pieces.length; tasks.push(piece); });
  }
  return tasks;
}
export function moduleOrder(preferences: Preferences): string[] {
  const target = preferences.goal === 'all' ? ['llm-basics', 'llm-app-dev', 'agents', 'rag']
    : preferences.goal === 'agent' ? ['llm-app-dev', 'agents']
    : preferences.goal === 'rag' ? ['llm-app-dev', 'rag']
    : preferences.goal === 'app' ? ['llm-app-dev'] : ['llm-basics', 'llm-app-dev'];
  return preferences.level === 'beginner' ? ['engineering-basics', ...target] : target;
}

export function minuteOf(time: string): number { const [hour = 0, minute = 0] = time.split(':').map(Number); return hour * 60 + minute; }
export function validSchedule(days: StudyDay[]): boolean {
  const seen = new Set<string>();
  return days.length > 0 && days.every(day => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || seen.has(day.date)) return false;
    seen.add(day.date);
    const date = new Date(day.date + 'T12:00:00');
    if (Number.isNaN(date.getTime()) || dateKey(date) !== day.date || (date.getDay() || 7) !== day.weekday) return false;
    let end = -1;
    return day.slots.every(slot => {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime) || !/^(?:([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(slot.endTime)) return false;
      const start = minuteOf(slot.startTime); const finish = minuteOf(slot.endTime);
      if (start < end || finish <= start) return false;
      end = finish; return true;
    });
  });
}
export function scheduleDatedPlan(lessons: PlanLesson[], days: StudyDay[]): PlanTask[] {
  if (!validSchedule(days)) return [];
  const pending = lessons.filter(item => !item.completed);
  const tasks: PlanTask[] = [];
  let index = 0; let used = 0;
  for (const day of [...days].sort((a,b) => a.date.localeCompare(b.date))) {
    for (const slot of day.slots) {
      let cursor = minuteOf(slot.startTime); const end = minuteOf(slot.endTime);
      while (cursor < end && index < pending.length) {
        const lesson = pending[index]!;
        const duration = Math.min(Math.max(1, lesson.minutes) - used, end - cursor);
        tasks.push({ ...lesson, date: day.date, duration, startMinute: cursor, endMinute: cursor + duration, part: 0, parts: 0 });
        cursor += duration; used += duration;
        if (used >= Math.max(1, lesson.minutes)) { index++; used = 0; }
      }
    }
  }
  for (const lesson of pending) {
    const pieces = tasks.filter(task => task.slug === lesson.slug && task.id === lesson.id);
    pieces.forEach((piece, index) => { piece.part = index + 1; piece.parts = pieces.length; });
  }
  return tasks;
}
