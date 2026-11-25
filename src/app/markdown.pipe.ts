import { Pipe, PipeTransform } from '@angular/core';
import { marked, Renderer } from 'marked';

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  transform(markdown: string | null | undefined): string {
    return renderMarkdown(markdown);
  }
}

export function renderMarkdown(markdown: string | null | undefined): string {
  if (!markdown) {
    return '';
  }

  const renderer = new Renderer();
  renderer.image = ({ text }) => escapeHtml(text);
  renderer.html = () => '';

  return marked.parse(markdown, { async: false, breaks: true, renderer });
}

function escapeHtml(text: string): string {
  const escapedCharacters: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (character) => escapedCharacters[character] ?? character);
}
