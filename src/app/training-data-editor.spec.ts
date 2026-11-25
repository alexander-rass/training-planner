import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import deTranslations from '../../public/i18n/de.json';
import enTranslations from '../../public/i18n/en.json';
import { vi } from 'vitest';
import { markdownFromEditableContent } from './markdown-description-editor';
import { TrainingDataEditor } from './training-data-editor';
import { trainingDataJson } from './training-data-test-fixtures';
import { TrainingDataStore } from './training-data-store';

describe('TrainingDataEditor', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainingDataEditor],
      providers: [provideTranslateService({ fallbackLang: 'en' })],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('de', deTranslations);
    translate.setTranslation('en', enTranslations);
    await firstValueFrom(translate.use('de'));
  });

  function createEditorFixture() {
    TestBed.inject(TrainingDataStore).load(trainingDataJson);
    const fixture = TestBed.createComponent(TrainingDataEditor);
    fixture.componentRef.setInput('isEditing', true);
    fixture.componentRef.setInput('resetToken', 1);
    fixture.detectChanges();
    return fixture;
  }

  function openEditorSection(
    fixture: ComponentFixture<TrainingDataEditor>,
    section: 'drills' | 'stages',
  ) {
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector(`.${section}-section-card`) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('presents editing areas separately and navigates back to the hub', () => {
    const fixture = createEditorFixture();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.editor-section-card')).toHaveLength(2);
    expect(compiled.querySelector('.stage-manager-page')).toBeNull();
    expect(compiled.querySelector('.editor-browser-page')).toBeNull();

    openEditorSection(fixture, 'stages');
    expect(compiled.querySelector('.stage-manager-page')).not.toBeNull();
    expect(compiled.querySelector('.editor-browser-page')).toBeNull();
    (
      compiled.querySelector('.stage-manager-page .editor-page-heading button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    openEditorSection(fixture, 'drills');
    expect(compiled.querySelector('.editor-browser-page')).not.toBeNull();
    expect(compiled.querySelector('.stage-manager-page')).toBeNull();
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    (
      compiled.querySelector('.editor-page-navigation button:last-child') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.editor-section-card')).toHaveLength(2);
    expect(compiled.querySelector('.editor-form')).toBeNull();
  });

  it('searches and filters drills while preserving filters when returning from drill details', () => {
    const fixture = createEditorFixture();
    openEditorSection(fixture, 'drills');
    const compiled = fixture.nativeElement as HTMLElement;
    const searchInput = compiled.querySelector('input[type="search"]') as HTMLInputElement;

    searchInput.value = 'u11';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.editor-drill-choice')).toHaveLength(1);
    expect(compiled.querySelector('.editor-drill-choice')?.textContent).toContain(
      'Passing for U11',
    );

    searchInput.value = 'moving';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.editor-drill-choice')).toHaveLength(1);
    expect(compiled.querySelector('.editor-drill-choice')?.textContent).toContain(
      'Passing for U11',
    );

    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const filters = compiled.querySelectorAll('.editor-browser-filters select');
    (filters[0] as HTMLSelectElement).value = 'warmup';
    (filters[0] as HTMLSelectElement).dispatchEvent(new Event('change'));
    (filters[1] as HTMLSelectElement).value = 'u11';
    (filters[1] as HTMLSelectElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.editor-drill-choice')).toHaveLength(1);
    expect(
      compiled.querySelector('.editor-browser > .editor-results-heading')?.textContent,
    ).toContain('1 von 2');

    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('.editor-form')).not.toBeNull();
    (compiled.querySelector('.editor-back-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('.editor-form')).toBeNull();
    expect(compiled.querySelectorAll('.editor-drill-choice')).toHaveLength(1);

    const filtersAfterBack = compiled.querySelectorAll('.editor-browser-filters select');
    expect((filtersAfterBack[0] as HTMLSelectElement).value).toBe('warmup');
    expect((filtersAfterBack[1] as HTMLSelectElement).value).toBe('u11');
    (filtersAfterBack[0] as HTMLSelectElement).value = '';
    (filtersAfterBack[0] as HTMLSelectElement).dispatchEvent(new Event('change'));
    (filtersAfterBack[1] as HTMLSelectElement).value = '';
    (filtersAfterBack[1] as HTMLSelectElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.editor-drill-choice')).toHaveLength(2);
  });

  it('rejects invalid title edits with actionable feedback and keeps valid data', () => {
    const fixture = createEditorFixture();
    openEditorSection(fixture, 'drills');
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    const titleInput = compiled.querySelector(
      '.editor-form .editor-field input',
    ) as HTMLInputElement;
    titleInput.value = '   ';
    titleInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(titleInput.value).toBe('Passing for U11');
    expect(compiled.querySelector('.data-editor .message.error')?.textContent).toContain(
      'Der Übungstitel darf nicht leer sein',
    );
    expect(compiled.querySelector('.unsaved-status')).toBeNull();
    expect(TestBed.inject(TrainingDataStore).hasUnsavedChanges()).toBe(false);
  });

  it('adds, edits, reorders, and deletes coaching points while rejecting blank text', () => {
    const fixture = createEditorFixture();
    openEditorSection(fixture, 'drills');
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.editor-coaching-point')).toHaveLength(1);
    const singlePointButtons = compiled.querySelectorAll(
      '.editor-coaching-point .coaching-point-actions button',
    );
    expect((singlePointButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((singlePointButtons[1] as HTMLButtonElement).disabled).toBe(true);
    expect((singlePointButtons[2] as HTMLButtonElement).textContent).toContain('Löschen');
    expect((singlePointButtons[2] as HTMLButtonElement).getAttribute('aria-label')).toBe(
      'Coaching-Punkt 1 löschen',
    );
    (compiled.querySelector('.editor-coaching-points .copy-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.editor-coaching-point')).toHaveLength(2);

    const textareas = compiled.querySelectorAll('.editor-coaching-point textarea');
    const addedPoint = textareas[1] as HTMLTextAreaElement;
    const defaultText = addedPoint.value;
    addedPoint.value = '   ';
    addedPoint.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(addedPoint.value).toBe(defaultText);
    expect(compiled.querySelector('.data-editor .message.error')?.textContent).toContain(
      'darf nicht leer sein',
    );

    addedPoint.value = 'Look before receiving.';
    addedPoint.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(TestBed.inject(TrainingDataStore).trainingData()?.drills[0]?.coachingPoints).toEqual([
      'Keep **moving**.',
      'Look before receiving.',
    ]);

    const moveEarlier = compiled.querySelector(
      '.editor-coaching-point:last-child .coaching-point-actions button:first-child',
    ) as HTMLButtonElement;
    moveEarlier.click();
    fixture.detectChanges();
    expect(TestBed.inject(TrainingDataStore).trainingData()?.drills[0]?.coachingPoints).toEqual([
      'Look before receiving.',
      'Keep **moving**.',
    ]);

    (compiled.querySelector('.editor-coaching-point .delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(TestBed.inject(TrainingDataStore).trainingData()?.drills[0]?.coachingPoints).toEqual([
      'Keep **moving**.',
    ]);

    (compiled.querySelector('.editor-coaching-point .delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(TestBed.inject(TrainingDataStore).trainingData()?.drills[0]?.coachingPoints).toEqual([]);
    expect(compiled.querySelectorAll('.editor-coaching-point textarea')).toHaveLength(0);
    expect(compiled.querySelector('.editor-coaching-points .editor-hint')?.textContent).toContain(
      'Noch keine Coaching-Punkte',
    );
  });

  it('edits descriptions visually and saves emphasis and lists as Markdown', () => {
    const fixture = createEditorFixture();
    openEditorSection(fixture, 'drills');
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    const surface = compiled.querySelector('.markdown-editor-surface') as HTMLDivElement;

    expect(surface.querySelector('strong')?.textContent).toBe('follow your pass');
    expect(surface.textContent).not.toContain('**');

    surface.innerHTML =
      '<p>Pass <strong>quickly</strong> and <em>look</em>.</p><ul><li>Move</li></ul><ol><li>Observe</li></ol>';
    surface.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(TestBed.inject(TrainingDataStore).trainingData()?.drills[0]?.descriptionMarkdown).toBe(
      'Pass **quickly** and *look*.\n\n- Move\n\n1. Observe',
    );
    expect(surface.querySelector('strong')?.textContent).toBe('quickly');
    expect(surface.querySelector('em')?.textContent).toBe('look');
    expect(surface.querySelector('ul li')?.textContent).toBe('Move');
    expect(surface.querySelector('ol li')?.textContent).toBe('Observe');
    expect(surface.textContent).not.toContain('**');
  });

  it('escapes Markdown syntax typed as ordinary text', () => {
    const editable = document.createElement('div');
    editable.textContent =
      'Literal **stars** and _underscores_.\n1. not a list\n- not a bullet\n# not a heading\n![image](url)';

    expect(markdownFromEditableContent(editable)).toBe(
      'Literal \\*\\*stars\\*\\* and \\_underscores\\_.\n1\\. not a list\n\\- not a bullet\n\\# not a heading\n\\!\\[image\\]\\(url\\)',
    );
  });

  it('preserves the cursor position when a formatting button receives focus', () => {
    const fixture = createEditorFixture();
    openEditorSection(fixture, 'drills');
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();

    const surface = compiled.querySelector('.markdown-editor-surface') as HTMLDivElement;
    const textNode = surface.querySelector('p')?.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 2);
    range.collapse(true);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));

    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');
    const execCommand = vi.fn(() => {
      expect(document.getSelection()?.anchorNode).toBe(textNode);
      expect(document.getSelection()?.anchorOffset).toBe(2);
      return true;
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    try {
      const bulletButton = compiled.querySelectorAll(
        '.markdown-editor-toolbar button',
      )[2] as HTMLButtonElement;
      bulletButton.focus();
      bulletButton.click();

      expect(execCommand).toHaveBeenCalledWith('insertUnorderedList');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(document, 'execCommand', originalDescriptor);
      } else {
        Reflect.deleteProperty(document, 'execCommand');
      }
    }
  });

  it('preserves emphasis when the browser uses styled spans', () => {
    const editable = document.createElement('div');
    editable.innerHTML =
      '<span style="font-weight: 700">Bold</span> <span style="font-style: italic">italic</span>';

    expect(markdownFromEditableContent(editable)).toBe('**Bold** *italic*');
  });

  it('creates, edits, reorders, and validates stages', () => {
    const fixture = createEditorFixture();
    openEditorSection(fixture, 'stages');
    const compiled = fixture.nativeElement as HTMLElement;
    const initialStageMoveButtons = compiled.querySelectorAll(
      '.stage-editor-row[aria-label="Warm-up"] .stage-order-controls button',
    );
    expect((initialStageMoveButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((initialStageMoveButtons[1] as HTMLButtonElement).disabled).toBe(true);

    (compiled.querySelector('.stage-manager .copy-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const store = TestBed.inject(TrainingDataStore);
    let stage = store
      .trainingData()
      ?.catalog.stages.find((candidate) => candidate.id === 'new-stage');
    expect(stage).toMatchObject({ label: 'Neue Phase', order: 2, defaultDrillCount: 1 });

    const stageRow = compiled.querySelector(
      '.stage-editor-row[aria-label="Neue Phase"]',
    ) as HTMLElement;
    const inputs = stageRow.querySelectorAll('input');
    (inputs[0] as HTMLInputElement).value = 'Finishing';
    inputs[0].dispatchEvent(new Event('change'));
    (inputs[1] as HTMLInputElement).value = '3';
    inputs[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    stage = store.trainingData()?.catalog.stages.find((candidate) => candidate.id === 'new-stage');
    expect(stage).toMatchObject({ label: 'Finishing', order: 2, defaultDrillCount: 3 });

    const updatedRow = compiled.querySelector(
      '.stage-editor-row[aria-label="Finishing"]',
    ) as HTMLElement;
    (updatedRow.querySelector('.stage-order-controls button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(
      store
        .trainingData()
        ?.catalog.stages.slice()
        .sort((left, right) => left.order - right.order)
        .map(({ id, order }) => ({ id, order })),
    ).toEqual([
      { id: 'new-stage', order: 1 },
      { id: 'warmup', order: 2 },
    ]);

    const reorderedRow = compiled.querySelector(
      '.stage-editor-row[aria-label="Finishing"]',
    ) as HTMLElement;
    const countInput = reorderedRow.querySelector('input[type="number"]') as HTMLInputElement;
    countInput.value = '-1';
    countInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(countInput.value).toBe('3');
    expect(compiled.querySelector('.data-editor .message.error')?.textContent).toContain(
      'nicht-negative ganze Zahl',
    );
    expect(
      store.trainingData()?.catalog.stages.find((candidate) => candidate.id === 'new-stage'),
    ).toMatchObject({ defaultDrillCount: 3 });
  });

  it('warns before deleting a used stage and supports cancellation or reassignment', () => {
    const fixture = createEditorFixture();
    openEditorSection(fixture, 'stages');
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('.stage-manager .copy-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const warmupRow = compiled.querySelector(
      '.stage-editor-row[aria-label="Warm-up"]',
    ) as HTMLElement;
    (warmupRow.querySelector('.delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const store = TestBed.inject(TrainingDataStore);
    expect(compiled.querySelector('.stage-delete-panel [role="alert"]')?.textContent).toContain(
      'Warm-up',
    );
    expect(compiled.querySelector('.stage-delete-panel')?.textContent).toContain('Passing for U11');
    expect(compiled.querySelector('.stage-delete-panel')?.textContent).toContain('Passing drill');
    expect(store.trainingData()?.catalog.stages.some((stage) => stage.id === 'warmup')).toBe(true);

    const reassignment = compiled.querySelector('.stage-delete-panel select') as HTMLSelectElement;
    reassignment.value = 'new-stage';
    reassignment.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (compiled.querySelector('.stage-delete-actions .text-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(store.trainingData()?.catalog.stages.some((stage) => stage.id === 'warmup')).toBe(true);

    (
      compiled.querySelector(
        '.stage-editor-row[aria-label="Warm-up"] .delete-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const confirmedReassignment = compiled.querySelector(
      '.stage-delete-panel select',
    ) as HTMLSelectElement;
    confirmedReassignment.value = 'new-stage';
    confirmedReassignment.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (compiled.querySelector('.stage-delete-actions .delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(store.trainingData()?.catalog.stages.map((stage) => stage.id)).toEqual(['new-stage']);
    expect(store.trainingData()?.drills.map((drill) => drill.availableStageIds)).toEqual([
      ['new-stage'],
      ['new-stage'],
    ]);
    expect(compiled.querySelector('.stage-delete-panel')).toBeNull();
  });

  it('shows a usage count and two examples when many drills use a stage', () => {
    const fixture = createEditorFixture();
    openEditorSection(fixture, 'stages');
    const compiled = fixture.nativeElement as HTMLElement;
    const store = TestBed.inject(TrainingDataStore);
    const data = store.trainingData();
    if (!data?.drills[0]) {
      throw new Error('The test training data must contain a drill.');
    }

    const firstDrill = data.drills[0];
    const error = store.applyChange((current) => ({
      ...current,
      drills: [
        ...current.drills,
        ...Array.from({ length: 3 }, (_, index) => ({
          ...firstDrill,
          id: `extra-drill-${index + 1}`,
          title: `Extra drill ${index + 1}`,
        })),
      ],
    }));
    expect(error).toBeNull();
    fixture.detectChanges();

    (
      compiled.querySelector(
        '.stage-editor-row[aria-label="Warm-up"] .delete-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.stage-delete-panel [role="alert"]')?.textContent).toContain(
      '5 Übungen',
    );
    expect(compiled.querySelectorAll('.stage-delete-panel li')).toHaveLength(2);
    expect(compiled.querySelector('.stage-delete-panel')?.textContent).not.toContain(
      'Extra drill 1',
    );
  });

  it('allows deleting the last used stage and leaves its drills unassigned', () => {
    const fixture = createEditorFixture();
    openEditorSection(fixture, 'stages');
    const compiled = fixture.nativeElement as HTMLElement;
    (
      compiled.querySelector(
        '.stage-editor-row[aria-label="Warm-up"] .delete-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const reassignment = compiled.querySelector('.stage-delete-panel select') as HTMLSelectElement;
    expect(reassignment.options).toHaveLength(1);
    expect(reassignment.value).toBe('');
    (compiled.querySelector('.stage-delete-actions .delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const data = TestBed.inject(TrainingDataStore).trainingData();
    expect(data?.catalog.stages).toEqual([]);
    expect(data?.drills.map((drill) => drill.availableStageIds)).toEqual([[], []]);
    expect(compiled.querySelector('.stage-manager-page .editor-hint')?.textContent).toContain(
      'keine Phasen definiert',
    );
  });
});
