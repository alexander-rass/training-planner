import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import deTranslations from '../../public/i18n/de.json';
import enTranslations from '../../public/i18n/en.json';
import scaJg2020Data from '../../data/sca_jg2020_data.json';
import { parseTrainingData } from './training-data';

const trainingDataJson = JSON.stringify({
  schemaVersion: 1,
  catalog: {
    stages: [{ id: 'warmup', label: 'Warm-up', order: 1, defaultDrillCount: 1 }],
    labels: [
      { id: 'passing', label: 'Passing' },
      { id: 'u11', label: 'U11' },
    ],
    mainFilterLabelIds: ['passing'],
    modifications: [
      {
        id: 'player-selection',
        label: 'Player selection',
        type: 'single-select',
        options: [{ id: 'line', label: 'Stand in line' }],
      },
    ],
  },
  drills: [
    {
      id: 'drill-001',
      title: 'Passing for U11',
      availableStageIds: ['warmup'],
      labelIds: ['passing', 'u11'],
      descriptionMarkdown: 'Pass and **follow your pass**.',
      coachingPoints: ['Keep **moving**.'],
      modificationIds: ['player-selection'],
      diagram: { kind: 'future-diagram' },
    },
    {
      id: 'drill-002',
      title: 'Passing drill',
      availableStageIds: ['warmup'],
      labelIds: ['passing'],
      descriptionMarkdown: 'Pass to a teammate.',
      modificationIds: [],
    },
  ],
});

const trainingDatasetCatalog = {
  schemaVersion: 1,
  datasets: [{ id: 'sca-jg-2020', name: 'SCA JG 2020', fileName: 'sca_jg2020_data.json' }],
};

async function createAppFixture() {
  const fixture = TestBed.createComponent(App);
  TestBed.inject(HttpTestingController)
    .expectOne('data/datasets.json')
    .flush(trainingDatasetCatalog);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function translationKeys(value: object, prefix = ''): string[] {
  return Object.entries(value)
    .flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof child === 'object' && child !== null && !Array.isArray(child)
        ? translationKeys(child, path)
        : [path];
    })
    .sort();
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ fallbackLang: 'en' }),
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('de', deTranslations);
    translate.setTranslation('en', enTranslations);
    await firstValueFrom(translate.use('de'));
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('should create the app', async () => {
    const fixture = await createAppFixture();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('provides the same translation keys in both languages', () => {
    expect(translationKeys(deTranslations)).toEqual(translationKeys(enTranslations));
  });

  it('switches between German and English at runtime', async () => {
    const fixture = await createAppFixture();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const languageSelect = compiled.querySelector('.language-picker select') as HTMLSelectElement;
    expect(languageSelect.value).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    expect(compiled.querySelector('.page-header h1')?.textContent).toContain(
      'Trainingseinheit planen',
    );
    expect(compiled.querySelector('.file-picker button')?.textContent).toContain('Datei auswählen');
    expect(compiled.querySelector('.file-name')?.textContent).toContain('Keine Datei ausgewählt');

    languageSelect.value = 'en';
    languageSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector('.page-header h1')?.textContent).toContain(
      'Build a training session',
    );
    expect(compiled.querySelector('.file-picker button')?.textContent).toContain('Choose file');
    expect(compiled.querySelector('.file-name')?.textContent).toContain('No file selected');
    expect(document.title).toBe('Training planner');
    expect(document.documentElement.lang).toBe('en');
  });

  it('should offer a JSON file picker', async () => {
    const fixture = await createAppFixture();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[type="file"]')?.getAttribute('accept')).toContain('.json');
  });

  it('loads stages, filters drill choices by labels, and resizes plan slots', async () => {
    const fixture = await createAppFixture();
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = {
      name: 'pilot-data.json',
      text: async () => trainingDataJson,
    };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.slot')).toHaveLength(1);
    expect(compiled.querySelector('.download-button')).not.toBeNull();
    expect(compiled.querySelector('.file-name')?.textContent).toContain('pilot-data.json');

    const u11Filter = compiled.querySelector(
      '.additional-filters .filter-chip',
    ) as HTMLButtonElement;
    u11Filter.click();
    fixture.detectChanges();

    const drillSelect = compiled.querySelector('.slot .select-control select') as HTMLSelectElement;
    expect(drillSelect.querySelectorAll('option')).toHaveLength(2);
    drillSelect.value = 'drill-001';
    drillSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(drillSelect.value).toBe('drill-001');
    expect(compiled.querySelector('.description')?.textContent).toContain(
      'Pass and follow your pass.',
    );
    expect(compiled.querySelector('.description strong')?.textContent).toBe('follow your pass');
    expect(compiled.querySelector('.description')?.textContent).not.toContain('**');
    expect(compiled.querySelector('.coaching-points h4')?.textContent).toBe('Coaching-Punkte');
    expect(compiled.querySelector('.coaching-points li')?.textContent).toContain('Keep moving.');

    const modificationSelect = compiled.querySelector('.modifications select') as HTMLSelectElement;
    modificationSelect.value = 'line';
    modificationSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const messagePreview = compiled.querySelector('.message-preview') as HTMLElement;
    expect(messagePreview.textContent).toContain('Warm-up');
    expect(messagePreview.textContent).toContain('Passing for U11');
    expect(messagePreview.textContent).toContain('Coaching-Punkte');
    expect(messagePreview.textContent).toContain('Keep moving.');
    expect(messagePreview.textContent).toContain('Player selection: Stand in line');
    expect(messagePreview.textContent).not.toContain('*');
    expect(messagePreview.querySelector('h2')?.textContent).toBe('Warm-up');
    expect(messagePreview.querySelector('ul ul')).not.toBeNull();

    const countInput = compiled.querySelector('.count-control input') as HTMLInputElement;
    countInput.value = '0';
    countInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(compiled.querySelector('.slot')).toBeNull();
    expect((compiled.querySelector('.share .copy-button') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('edits a drill title in the working copy and keeps the selected plan drill', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const file = { name: 'pilot-data.json', text: async () => trainingDataJson };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const drillSelect = compiled.querySelector('.slot .select-control select') as HTMLSelectElement;
    drillSelect.value = 'drill-001';
    drillSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(drillSelect.value).toBe('drill-001');

    const editButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();

    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    const titleInput = compiled.querySelector(
      '.editor-form .editor-field input',
    ) as HTMLInputElement;
    titleInput.value = 'Updated passing drill';
    titleInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance['stagePlans']()[0]?.slots[0]?.drillId).toBe('drill-001');
    expect(compiled.querySelector('.unsaved-status')?.textContent).toContain(
      'Bearbeitete Daten wurden noch nicht exportiert.',
    );

    const returnButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Zurück zum Planer'),
    ) as HTMLButtonElement;
    returnButton.click();
    fixture.detectChanges();

    const restoredDrillSelect = compiled.querySelector(
      '.slot .select-control select',
    ) as HTMLSelectElement;
    expect([...restoredDrillSelect.options].map((option) => option.value)).toContain('drill-001');
    expect(restoredDrillSelect.value).toBe('drill-001');
    expect(compiled.querySelector('.message-preview')?.textContent).toContain(
      'Updated passing drill',
    );
  });

  it('adds and deletes drills, clearing plan selections for a deleted drill', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const file = { name: 'pilot-data.json', text: async () => trainingDataJson };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const drillSelect = compiled.querySelector('.slot .select-control select') as HTMLSelectElement;
    drillSelect.value = 'drill-001';
    drillSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const editButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();

    (compiled.querySelector('.editor-actions button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(
      (compiled.querySelector('.editor-form .editor-field input') as HTMLInputElement).value,
    ).toBe('Neue Übung');
    (compiled.querySelector('.delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalled();
    expect(compiled.querySelectorAll('.editor-drill-choice')).toHaveLength(2);
    expect(compiled.querySelector('.unsaved-status')).toBeNull();

    const selectedOriginalDrill = compiled.querySelector(
      '.editor-drill-choice',
    ) as HTMLButtonElement;
    expect(selectedOriginalDrill.textContent).toContain('Passing for U11');
    selectedOriginalDrill.click();
    fixture.detectChanges();
    (compiled.querySelector('.delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const returnButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Zurück zum Planer'),
    ) as HTMLButtonElement;
    returnButton.click();
    fixture.detectChanges();

    expect(
      (compiled.querySelector('.slot .select-control select') as HTMLSelectElement).value,
    ).toBe('');
  });

  it('searches and filters the drill list by title, stage, and label', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const file = { name: 'pilot-data.json', text: async () => trainingDataJson };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const editButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();

    const searchInput = compiled.querySelector('input[type="search"]') as HTMLInputElement;
    searchInput.value = 'u11';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.editor-drill-choice')).toHaveLength(1);
    expect(compiled.querySelector('.editor-drill-choice')?.textContent).toContain(
      'Passing for U11',
    );

    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

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
    expect(compiled.querySelector('.editor-results-heading')?.textContent).toContain('1 von 2');

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

  it('rejects invalid title edits with actionable feedback and keeps valid data', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const file = { name: 'pilot-data.json', text: async () => trainingDataJson };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const editButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();
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
    expect((compiled.querySelector('.header-actions button') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('exports edited data as JSON and clears the unsaved indicator after export', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const file = { name: 'pilot-data.json', text: async () => trainingDataJson };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const editButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    const titleInput = compiled.querySelector(
      '.editor-form .editor-field input',
    ) as HTMLInputElement;
    titleInput.value = 'Exported drill title';
    titleInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const labelOptions = compiled
      .querySelectorAll('.editor-choice-group')[1]
      ?.querySelectorAll('input[type="checkbox"]');
    (labelOptions?.[1] as HTMLInputElement).click();
    fixture.detectChanges();

    const createObjectUrl = vi.fn((_blob: Blob) => 'blob:training-data');
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();

    const exportButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Bearbeitete JSON exportieren'),
    ) as HTMLButtonElement;
    exportButton.click();
    fixture.detectChanges();
    vi.runOnlyPendingTimers();

    const exportedBlob = createObjectUrl.mock.calls[0]?.[0];
    expect(exportedBlob).toBeInstanceOf(Blob);
    const exportedData = JSON.parse(await exportedBlob!.text()) as {
      drills: { title: string; labelIds: string[]; diagram?: unknown }[];
    };
    expect(exportedData.drills[0]?.title).toBe('Exported drill title');
    expect(exportedData.drills[0]?.labelIds).toEqual(['passing']);
    expect(exportedData.drills[0]?.diagram).toEqual({ kind: 'future-diagram' });
    expect(compiled.querySelector('.unsaved-status')).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:training-data');
  });

  it('warns before replacing edited training data', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const file = { name: 'pilot-data.json', text: async () => trainingDataJson };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const editButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    const titleInput = compiled.querySelector(
      '.editor-form .editor-field input',
    ) as HTMLInputElement;
    titleInput.value = 'Unsaved title';
    titleInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const datasetSelect = compiled.querySelector('.dataset-picker select') as HTMLSelectElement;
    datasetSelect.value = 'sca-jg-2020';
    datasetSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('verwirft deine aktuellen Änderungen'),
    );
    TestBed.inject(HttpTestingController).expectNone('data/sca_jg2020_data.json');
  });

  it('reloads the same JSON file after confirming replacement of edited data', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const initialFile = { name: 'pilot-data.json', text: async () => trainingDataJson };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [initialFile] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const editButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    const titleInput = compiled.querySelector(
      '.editor-form .editor-field input',
    ) as HTMLInputElement;
    titleInput.value = 'Edited before reload';
    titleInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const reloadedFile = {
      name: 'pilot-data.json',
      text: vi.fn().mockResolvedValue(trainingDataJson),
    };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [reloadedFile] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('verwirft deine aktuellen Änderungen'),
    );
    expect(reloadedFile.text).toHaveBeenCalledOnce();
    expect(compiled.querySelector('.file-name')?.textContent).toContain('pilot-data.json');

    const enterEditButton = [...compiled.querySelectorAll('.header-actions button')].find(
      (button) => button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    enterEditButton.click();
    fixture.detectChanges();
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(
      (compiled.querySelector('.editor-form .editor-field input') as HTMLInputElement).value,
    ).toBe('Passing for U11');
  });

  it('reloads the selected predefined dataset after its working copy was edited', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const datasetSelect = compiled.querySelector('.dataset-picker select') as HTMLSelectElement;
    datasetSelect.value = 'sca-jg-2020';
    datasetSelect.dispatchEvent(new Event('change'));
    TestBed.inject(HttpTestingController)
      .expectOne('data/sca_jg2020_data.json')
      .flush(JSON.stringify(scaJg2020Data));
    await fixture.whenStable();
    fixture.detectChanges();

    const editButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    const titleInput = compiled.querySelector(
      '.editor-form .editor-field input',
    ) as HTMLInputElement;
    titleInput.value = 'Edited predefined drill';
    titleInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const reloadButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('neu laden'),
    ) as HTMLButtonElement;
    reloadButton.click();
    TestBed.inject(HttpTestingController)
      .expectOne('data/sca_jg2020_data.json')
      .flush(JSON.stringify(scaJg2020Data));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('verwirft deine aktuellen Änderungen'),
    );
    const reopenEditor = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    reopenEditor.click();
    fixture.detectChanges();
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(
      (compiled.querySelector('.editor-form .editor-field input') as HTMLInputElement).value,
    ).toBe(scaJg2020Data.drills[0]?.title);
    expect(compiled.querySelector('.unsaved-status')).toBeNull();
  });

  it('clears a plan selection when editing removes that drill from its stage', async () => {
    const data = parseTrainingData(JSON.parse(trainingDataJson) as unknown);
    const dataWithAnotherStage = {
      ...data,
      catalog: {
        ...data.catalog,
        stages: [
          ...data.catalog.stages,
          { id: 'game', label: 'Game', order: 2, defaultDrillCount: 0 },
        ],
      },
      drills: data.drills.map((drill) =>
        drill.id === 'drill-001' ? { ...drill, availableStageIds: ['warmup', 'game'] } : drill,
      ),
    };

    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const file = {
      name: 'pilot-data.json',
      text: async () => JSON.stringify(dataWithAnotherStage),
    };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const drillSelect = compiled.querySelector('.slot .select-control select') as HTMLSelectElement;
    drillSelect.value = 'drill-001';
    drillSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const editButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();

    const availableStageInputs = compiled.querySelectorAll(
      '.editor-choice-group input[type="checkbox"]',
    );
    (availableStageInputs[0] as HTMLInputElement).click();
    fixture.detectChanges();

    expect((availableStageInputs[0] as HTMLInputElement).checked).toBe(false);
    expect(
      (compiled.querySelector('.slot .select-control select') as HTMLSelectElement).value,
    ).toBe('');
    (availableStageInputs[1] as HTMLInputElement).click();
    fixture.detectChanges();
    expect((availableStageInputs[1] as HTMLInputElement).checked).toBe(false);
    expect(compiled.querySelector('.data-editor .message.error')).toBeNull();
  });

  it('loads a selected named dataset from its deployed data file', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const datasetSelect = compiled.querySelector('.dataset-picker select') as HTMLSelectElement;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    datasetSelect.value = 'sca-jg-2020';
    datasetSelect.dispatchEvent(new Event('change'));
    TestBed.inject(HttpTestingController)
      .expectOne('data/sca_jg2020_data.json')
      .flush(JSON.stringify(scaJg2020Data));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(datasetSelect.value).toBe('sca-jg-2020');
    expect(compiled.querySelector('.stage h2')?.textContent).toBe('Warm-up');
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('keeps the current plan when replacement with a named dataset is canceled', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const initialFile = { name: 'pilot-data.json', text: async () => trainingDataJson };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [initialFile] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const drillSelect = compiled.querySelector('.slot .select-control select') as HTMLSelectElement;
    drillSelect.value = 'drill-001';
    drillSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const datasetSelect = compiled.querySelector('.dataset-picker select') as HTMLSelectElement;
    datasetSelect.value = 'sca-jg-2020';
    datasetSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('SCA JG 2020'));
    expect(datasetSelect.value).toBe('');
    expect(
      (compiled.querySelector('.slot .select-control select') as HTMLSelectElement).value,
    ).toBe('drill-001');
    TestBed.inject(HttpTestingController).expectNone('data/sca_jg2020_data.json');
  });

  it('loads a named dataset after confirming replacement', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const initialFile = { name: 'pilot-data.json', text: async () => trainingDataJson };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [initialFile] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const datasetSelect = compiled.querySelector('.dataset-picker select') as HTMLSelectElement;
    datasetSelect.value = 'sca-jg-2020';
    datasetSelect.dispatchEvent(new Event('change'));
    TestBed.inject(HttpTestingController)
      .expectOne('data/sca_jg2020_data.json')
      .flush(JSON.stringify(scaJg2020Data));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('SCA JG 2020'));
    expect(compiled.querySelectorAll('.stage')).toHaveLength(3);
    expect(datasetSelect.value).toBe('sca-jg-2020');
  });

  it('does not read a replacement JSON file when its confirmation is canceled', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const fileInput = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    const initialFile = { name: 'pilot-data.json', text: async () => trainingDataJson };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [initialFile] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const drillSelect = compiled.querySelector('.slot .select-control select') as HTMLSelectElement;
    drillSelect.value = 'drill-001';
    drillSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const replacementFile = {
      name: 'replacement.json',
      text: vi.fn().mockResolvedValue(trainingDataJson),
    };
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [replacementFile] });
    fileInput.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('replacement.json'));
    expect(replacementFile.text).not.toHaveBeenCalled();
    expect(compiled.querySelector('.file-name')?.textContent).toContain('pilot-data.json');
    expect(
      (compiled.querySelector('.slot .select-control select') as HTMLSelectElement).value,
    ).toBe('drill-001');
  });
});
