import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  it('renders Markdown emphasis and lists as HTML', () => {
    const rendered = new MarkdownPipe().transform('**Bold text**\n\n- A point');

    expect(rendered).toContain('<strong>Bold text</strong>');
    expect(rendered).toContain('<li>A point</li>');
    expect(rendered).not.toContain('**');
  });
});
