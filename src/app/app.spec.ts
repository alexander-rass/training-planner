import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { App } from './app';
import deTranslations from '../../public/i18n/de.json';
import enTranslations from '../../public/i18n/en.json';
import scaJg2020Data from '../../data/sca_jg2020_data.json';

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
    expect((compiled.querySelector('.copy-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('loads a selected named dataset from its deployed data file', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const datasetSelect = compiled.querySelector('.dataset-picker select') as HTMLSelectElement;

    datasetSelect.value = 'sca-jg-2020';
    datasetSelect.dispatchEvent(new Event('change'));
    TestBed.inject(HttpTestingController)
      .expectOne('data/sca_jg2020_data.json')
      .flush(JSON.stringify(scaJg2020Data));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(datasetSelect.value).toBe('sca-jg-2020');
    expect(compiled.querySelector('.stage h2')?.textContent).toBe('Warm-up');
  });
});
