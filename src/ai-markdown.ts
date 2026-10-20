import MarkdownIt from 'markdown-it';
import cjkFriendly from 'markdown-it-cjk-friendly';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false }).use(cjkFriendly);
const defaultLink = markdown.renderer.rules.link_open;
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  tokens[index]!.attrSet('target', '_blank');
  tokens[index]!.attrSet('rel', 'noopener noreferrer');
  return defaultLink ? defaultLink(tokens, index, options, env, renderer) : renderer.renderToken(tokens, index, options);
};
// Model text must not silently load remote images or send conversation data to an image host.
markdown.renderer.rules.image = (tokens, index) => `[图片：${markdown.utils.escapeHtml(tokens[index]!.content || '未提供描述')}]`;

export function renderAiMarkdown(source: string): string { return markdown.render(source); }

