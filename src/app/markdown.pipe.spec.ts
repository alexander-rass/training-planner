import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  it('renders Markdown emphasis and lists as HTML', () => {
    const rendered = new MarkdownPipe().transform('**Bold text**\n\n- A point');

    expect(rendered).toContain('<strong>Bold text</strong>');
    expect(rendered).toContain('<li>A point</li>');
    expect(rendered).not.toContain('**');
  });

  it('does not render remote Markdown images or raw HTML', () => {
    const rendered = new MarkdownPipe().transform(
      '![training diagram](https://tracker.example/pixel.png)\n\n<img src="https://tracker.example/raw.png">',
    );

    expect(rendered).toContain('training diagram');
    expect(rendered).not.toContain('<img');
    expect(rendered).not.toContain('tracker.example');
  });
});
