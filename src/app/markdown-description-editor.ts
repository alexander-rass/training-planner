import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { renderMarkdown } from './markdown.pipe';

type FormattingCommand = 'bold' | 'italic' | 'insertUnorderedList' | 'insertOrderedList';

@Component({
  selector: 'app-markdown-description-editor',
  imports: [TranslatePipe],
  templateUrl: './markdown-description-editor.html',
})
export class MarkdownDescriptionEditor implements OnChanges {
  @Input() markdown = '';
  @Input() disabled = false;
  @Output() readonly markdownChange = new EventEmitter<string>();
  @Output() readonly formattingFailed = new EventEmitter<void>();
  @ViewChild('surface') private surface?: ElementRef<HTMLDivElement>;

  protected readonly renderedHtml = signal('');
  protected readonly boldActive = signal(false);
  protected readonly italicActive = signal(false);
  private lastEmittedMarkdown = '';
  private savedSelection: Range | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['markdown']) {
      this.lastEmittedMarkdown = this.markdown;
      if (!this.isFocusedWithinEditor()) {
        this.renderedHtml.set(renderMarkdown(this.markdown));
        this.savedSelection = null;
      }
    }
  }

  protected applyFormatting(command: FormattingCommand): void {
    const surface = this.surface?.nativeElement;
    if (!surface || this.disabled) {
      return;
    }

    surface.focus();
    this.restoreSelection(surface);
    if (!document.execCommand(command)) {
      this.formattingFailed.emit();
      return;
    }
    this.onInput();
    this.updateInlineFormattingState();
  }

  @HostListener('document:selectionchange')
  protected onSelectionChanged(): void {
    const surface = this.surface?.nativeElement;
    const selection = document.getSelection();
    if (surface && selection?.anchorNode && surface.contains(selection.anchorNode)) {
      this.saveSelection(surface);
      this.updateInlineFormattingState();
    }
  }

  protected onInput(): void {
    const surface = this.surface?.nativeElement;
    if (!surface || this.disabled) {
      return;
    }

    this.emitMarkdown(markdownFromEditableContent(surface));
    this.saveSelection(surface);
    this.updateInlineFormattingState();
  }

  protected onBlur(): void {
    const surface = this.surface?.nativeElement;
    if (surface) {
      this.saveSelection(surface);
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain');
    if (text !== undefined) {
      if (!text) {
        return;
      }
      if (document.execCommand('insertText', false, text)) {
        this.onInput();
      } else {
        this.formattingFailed.emit();
      }
    } else {
      this.formattingFailed.emit();
    }
  }

  protected preserveSelection(event: PointerEvent): void {
    event.preventDefault();
  }

  private isFocusedWithinEditor(): boolean {
    const editor = this.surface?.nativeElement.parentElement;
    return (
      typeof document !== 'undefined' &&
      editor !== null &&
      editor !== undefined &&
      editor.contains(document.activeElement)
    );
  }

  private emitMarkdown(markdown: string): void {
    if (markdown !== this.lastEmittedMarkdown) {
      this.lastEmittedMarkdown = markdown;
      this.markdownChange.emit(markdown);
    }
  }

  private saveSelection(surface: HTMLDivElement): void {
    const selection = document.getSelection();
    if (selection?.rangeCount && surface.contains(selection.anchorNode)) {
      this.savedSelection = selection.getRangeAt(0).cloneRange();
    }
  }

  private restoreSelection(surface: HTMLDivElement): void {
    if (!this.savedSelection || !surface.contains(this.savedSelection.startContainer)) {
      return;
    }

    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(this.savedSelection);
    this.savedSelection = null;
  }

  private updateInlineFormattingState(): void {
    const queryCommandState = document.queryCommandState;
    if (typeof queryCommandState !== 'function') {
      return;
    }
    this.boldActive.set(queryCommandState.call(document, 'bold'));
    this.italicActive.set(queryCommandState.call(document, 'italic'));
  }
}

export function markdownFromEditableContent(root: HTMLElement): string {
  return serializeChildren(root)
    .trim()
    .replace(/\n{3,}/g, '\n\n');
}

function serializeChildren(root: ParentNode): string {
  return Array.from(root.childNodes, serializeNode).join('');
}

function serializeNode(node: Node): string {
  if (node.nodeType === 3) {
    return escapeMarkdownText(node.nodeValue ?? '');
  }
  if (node.nodeType !== 1) {
    return '';
  }

  const element = node as Element;
  const children = serializeChildren(element);
  switch (element.tagName) {
    case 'B':
    case 'STRONG':
      return `**${children}**`;
    case 'I':
    case 'EM':
      return `*${children}*`;
    case 'BR':
      return '\n';
    case 'UL':
    case 'OL':
      return `${serializeList(element)}\n\n`;
    case 'LI':
      return children;
    case 'P':
    case 'DIV':
      return `${children}\n\n`;
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return `${'#'.repeat(Number(element.tagName[1]))} ${children}\n\n`;
    case 'BLOCKQUOTE':
      return `${children
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')}\n\n`;
    case 'CODE':
      return `\`${(element.textContent ?? '').replaceAll('`', '\\`')}\``;
    case 'SPAN': {
      const style = (element as HTMLElement).style;
      const bold = style.fontWeight === 'bold' || Number(style.fontWeight) >= 600;
      const italic = ['italic', 'oblique'].includes(style.fontStyle);
      return `${bold ? '**' : ''}${italic ? '*' : ''}${children}${italic ? '*' : ''}${bold ? '**' : ''}`;
    }
    default:
      return children;
  }
}

function serializeList(list: Element, depth = 0): string {
  const ordered = list.tagName === 'OL';
  return Array.from(list.children)
    .filter((child) => child.tagName === 'LI')
    .map((item, index) => {
      let itemText = '';
      const nestedLists: Element[] = [];
      for (const child of Array.from(item.childNodes)) {
        if (
          child.nodeType === 1 &&
          ((child as Element).tagName === 'UL' || (child as Element).tagName === 'OL')
        ) {
          nestedLists.push(child as Element);
        } else {
          itemText += serializeNode(child);
        }
      }

      const marker = ordered ? `${index + 1}. ` : '- ';
      const indentation = '  '.repeat(depth);
      const nested = nestedLists
        .map((nestedList) => serializeList(nestedList, depth + 1))
        .join('\n');
      return `${indentation}${marker}${itemText.trim()}${nested ? `\n${nested}` : ''}`;
    })
    .join('\n');
}

function escapeMarkdownText(text: string): string {
  return text
    .replace(/[\\`*_{}\[\]()!<>]/g, '\\$&')
    .replace(/(^|\n)([ \t]*)(#{1,6}|>|[-+*])(?=\s)/g, '$1$2\\$3')
    .replace(/(^|\n)([ \t]*)(\d+)\.(?=\s)/g, '$1$2$3\\.');
}
