import MarkdownIt from 'markdown-it';
import cjkFriendly from 'markdown-it-cjk-friendly';

// Keep authored HTML as text; markdown-it also rejects unsafe link protocols.
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false }).use(cjkFriendly);
const defaultLink = markdown.renderer.rules.link_open;
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  tokens[index]!.attrSet('target', '_blank');
  tokens[index]!.attrSet('rel', 'noopener noreferrer');
  return defaultLink ? defaultLink(tokens, index, options, env, renderer) : renderer.renderToken(tokens, index, options);
};

export function renderMarkdown(source: string): string {
  return markdown.render(source);
}

// Parse headings as Markdown tokens so fenced examples cannot become sections.
// Both reading layouts use the same renderer with authored HTML disabled.
export type LessonDiagram = { kind: 'flow' | 'compare'; steps: { title: string; description: string }[] };

export function renderLessonSections(source: string): { title: string; html: string; contentHtml: string; diagrams: LessonDiagram[] }[] {
  const tokens = markdown.parse(source, {});
  const groups: { start: number; title: string }[] = [{ start: 0, title: '' }];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.type === 'heading_open' && tokens[i]!.tag === 'h2' && tokens[i]!.level === 0) {
      groups.push({ start: i, title: tokens[i + 1]?.content ?? '' });
    }
  }
  return groups.map((group, index) => {
    const sectionTokens = tokens.slice(group.start, groups[index + 1]?.start);
    const html = markdown.renderer.render(sectionTokens, markdown.options, {});
    const diagrams: LessonDiagram[] = [];
    const contentTokens = (group.title ? sectionTokens.slice(3) : sectionTokens).filter(token => {
      const kind = token.info.trim();
      if (!group.title || group.title === '延伸阅读' || token.type !== 'fence' || token.level !== 0 || (kind !== 'flow' && kind !== 'compare')) return true;
      const rows = token.content.trim().split('\n').map(line => line.split('|').map(cell => cell.trim()));
      // Malformed diagrams stay visible as code rather than silently losing content.
      if (rows.length < 2 || rows.length > 4 || rows.some(row => row.length !== 2 || !row[0] || !row[1])) return true;
      diagrams.push({ kind, steps: rows.map(row => ({ title: row[0]!, description: row[1]! })) });
      return false;
    });
    const contentHtml = markdown.renderer.render(contentTokens, markdown.options, {});
    return { title: group.title, html, contentHtml, diagrams };
  });
}

// Group existing Markdown sections without enabling authored HTML.
export function renderLessonMarkdown(source: string): string {
  return renderLessonSections(source).map(({ title, html }) => {
    const kind = /自测|总结/.test(title) ? 'review' : /小实验|小练习|为什么.*重要/.test(title) ? 'tip' : '';
    return kind ? `<section class="lesson-callout lesson-callout-${kind}">${html}</section>` : html;
  }).join('');
}
