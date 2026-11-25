import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import deTranslations from '../../public/i18n/de.json';
import enTranslations from '../../public/i18n/en.json';
import scaJg2020Data from '../../data/sca_jg2020_data.json';
import { parseTrainingData } from './training-data';
import { trainingDataJson, trainingDatasetCatalog } from './training-data-test-fixtures';
import { TrainingDataStore } from './training-data-store';

async function createAppFixture() {
  const fixture = TestBed.createComponent(App);
  TestBed.inject(HttpTestingController)
    .expectOne('data/datasets.json')
    .flush(trainingDatasetCatalog);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function openEditorSection(fixture: ComponentFixture<App>, section: 'drills' | 'stages'): void {
  const compiled = fixture.nativeElement as HTMLElement;
  const sectionButton = compiled.querySelector(
    `.editor-section-card.${section}-section-card`,
  ) as HTMLButtonElement;
  sectionButton.click();
  fixture.detectChanges();
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

  it('creates drills before stages and exports the new dataset under a new filename', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.welcome')).not.toBeNull();
    (compiled.querySelector('.welcome button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector('.welcome')).toBeNull();
    expect(compiled.querySelector('.data-editor')?.hasAttribute('hidden')).toBe(false);
    expect(compiled.querySelector('.editor-start-guidance')?.textContent).toContain(
      'Für einen Trainingsplan brauchst du Phasen und Übungen',
    );
    const initialData = TestBed.inject(TrainingDataStore).trainingData();
    expect(initialData).toEqual({
      schemaVersion: 1,
      catalog: { stages: [], labels: [], mainFilterLabelIds: [], modifications: [] },
      drills: [],
    });

    openEditorSection(fixture, 'drills');
    const addDrillButton = compiled.querySelector(
      '.editor-actions .copy-button',
    ) as HTMLButtonElement;
    expect(addDrillButton.disabled).toBe(false);
    addDrillButton.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.editor-form')).not.toBeNull();
    expect(TestBed.inject(TrainingDataStore).trainingData()?.drills[0]?.availableStageIds).toEqual(
      [],
    );
    (
      compiled.querySelector('.editor-page-navigation button:last-child') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    openEditorSection(fixture, 'stages');
    (
      compiled.querySelector('.stage-manager-page .stage-manager .copy-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.stage-editor-row')).toHaveLength(1);
    (
      compiled.querySelector('.stage-manager-page .editor-page-heading button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    openEditorSection(fixture, 'drills');
    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    const stageCheckbox = compiled.querySelector(
      '.editor-choice-group input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(stageCheckbox.checked).toBe(false);
    stageCheckbox.click();
    fixture.detectChanges();
    expect(TestBed.inject(TrainingDataStore).trainingData()?.drills[0]?.availableStageIds).toEqual([
      'new-stage',
    ]);

    const createObjectUrl = vi.fn((_blob: Blob) => 'blob:new-training-data');
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    let downloadedFileName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFileName = this.download;
    });
    vi.useFakeTimers();

    const exportButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Bearbeitete JSON exportieren'),
    ) as HTMLButtonElement;
    exportButton.click();
    fixture.detectChanges();
    vi.runOnlyPendingTimers();

    expect(downloadedFileName).toBe('new-training-data-export.json');
    const exportedBlob = createObjectUrl.mock.calls[0]?.[0];
    expect(exportedBlob).toBeInstanceOf(Blob);
    const exportedData = JSON.parse(await exportedBlob!.text()) as {
      catalog: { stages: unknown[] };
      drills: unknown[];
    };
    expect(exportedData.catalog.stages).toHaveLength(1);
    expect(exportedData.drills).toHaveLength(1);
    expect(compiled.querySelector('.unsaved-status')).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:new-training-data');
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
    openEditorSection(fixture, 'drills');

    (compiled.querySelector('.editor-drill-choice') as HTMLButtonElement).click();
    fixture.detectChanges();
    const titleInput = compiled.querySelector(
      '.editor-form .editor-field input',
    ) as HTMLInputElement;
    titleInput.value = 'Updated passing drill';
    titleInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(
      (compiled.querySelector('.slot .select-control select') as HTMLSelectElement).value,
    ).toBe('drill-001');
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
    openEditorSection(fixture, 'drills');

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
    openEditorSection(fixture, 'drills');
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
    openEditorSection(fixture, 'drills');
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
    openEditorSection(fixture, 'drills');
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
    openEditorSection(fixture, 'drills');
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
    openEditorSection(fixture, 'drills');
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
    openEditorSection(fixture, 'drills');
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
    openEditorSection(fixture, 'drills');
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

  it('clears a deleted stage from the plan while retaining selections in reassigned stages', async () => {
    const data = parseTrainingData(JSON.parse(trainingDataJson) as unknown);
    const dataWithAnotherStage = {
      ...data,
      catalog: {
        ...data.catalog,
        stages: [
          ...data.catalog.stages,
          { id: 'game', label: 'Game', order: 2, defaultDrillCount: 1 },
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

    const planDrillSelects = compiled.querySelectorAll('.stage .slot > .select-control select');
    for (const select of planDrillSelects) {
      (select as HTMLSelectElement).value = 'drill-001';
      select.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();

    const editButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Daten bearbeiten'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();
    openEditorSection(fixture, 'stages');
    (
      compiled.querySelector(
        '.stage-editor-row[aria-label="Warm-up"] .delete-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const reassignment = compiled.querySelector('.stage-delete-panel select') as HTMLSelectElement;
    reassignment.value = 'game';
    reassignment.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (compiled.querySelector('.stage-delete-actions .delete-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const returnButton = [...compiled.querySelectorAll('.header-actions button')].find((button) =>
      button.textContent?.includes('Zurück zum Planer'),
    ) as HTMLButtonElement;
    returnButton.click();
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.stage')).toHaveLength(1);
    expect(compiled.querySelector('.stage h2')?.textContent).toBe('Game');
    expect(
      (compiled.querySelector('.stage .slot .select-control select') as HTMLSelectElement).value,
    ).toBe('drill-001');
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
