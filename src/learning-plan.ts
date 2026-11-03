export type Preferences = { goal: string; level: string; minutes: number; days: number[] };
export type PlanLesson = { id: number; slug: string; title: string; module: string; minutes: number; completed: boolean };
export type PlanTask = PlanLesson & { date: string; duration: number; part: number; parts: number };
export type SavedPlan = { version: 1; preferences: Preferences; started: string };
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function schedulePlan(lessons: PlanLesson[], preferences: Preferences, start: string): PlanTask[] {
  if (!preferences.days.length || preferences.minutes < 1) return [];
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
  const target = preferences.goal === 'agent' ? ['llm-app-dev', 'agents']
    : preferences.goal === 'rag' ? ['llm-app-dev', 'rag']
    : preferences.goal === 'app' ? ['llm-app-dev'] : ['llm-basics', 'llm-app-dev'];
  return preferences.level === 'beginner' ? ['engineering-basics', ...target] : target;
}
