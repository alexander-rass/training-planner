import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import deTranslations from '../../public/i18n/de.json';
import enTranslations from '../../public/i18n/en.json';
import { TrainingDataStore } from './training-data-store';
import { trainingDataJson } from './training-data-test-fixtures';
import { TrainingPlanView } from './training-plan-view';

describe('TrainingPlanView', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainingPlanView],
      providers: [provideTranslateService({ fallbackLang: 'en' })],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('de', deTranslations);
    translate.setTranslation('en', enTranslations);
    await firstValueFrom(translate.use('de'));
  });

  function createPlanFixture() {
    TestBed.inject(TrainingDataStore).load(trainingDataJson);
    const fixture = TestBed.createComponent(TrainingPlanView);
    fixture.componentRef.setInput('resetToken', 1);
    fixture.detectChanges();
    return fixture;
  }

  it('filters drill choices by labels, formats drill content, and resizes plan slots', () => {
    const fixture = createPlanFixture();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.slot')).toHaveLength(1);
    expect(compiled.querySelector('.stage h2')?.textContent).toContain('Warm-up');

    (compiled.querySelector('.additional-filters .filter-chip') as HTMLButtonElement).click();
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
});
