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
