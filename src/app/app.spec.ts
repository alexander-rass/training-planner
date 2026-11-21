import { TestBed } from '@angular/core/testing';
import { App } from './app';

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

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should offer a JSON file picker', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[type="file"]')?.getAttribute('accept')).toContain('.json');
  });

  it('loads stages, filters drill choices by labels, and resizes plan slots', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
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
    expect(compiled.querySelector('.download-button')?.textContent).toContain('Download JSON copy');

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

    const modificationSelect = compiled.querySelector('.modifications select') as HTMLSelectElement;
    modificationSelect.value = 'line';
    modificationSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const messagePreview = compiled.querySelector(
      '[aria-label="Formatted WhatsApp message preview"]',
    ) as HTMLElement;
    expect(messagePreview.textContent).toContain('Warm-up');
    expect(messagePreview.textContent).toContain('Passing for U11');
    expect(messagePreview.textContent).toContain('Player selection: Stand in line');
    expect(messagePreview.textContent).not.toContain('*');
    expect(messagePreview.querySelector('h2')?.textContent).toBe('Warm-up');

    const countInput = compiled.querySelector('.count-control input') as HTMLInputElement;
    countInput.value = '0';
    countInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(compiled.querySelector('.slot')).toBeNull();
    expect((compiled.querySelector('.copy-button') as HTMLButtonElement).disabled).toBe(true);
  });
});
