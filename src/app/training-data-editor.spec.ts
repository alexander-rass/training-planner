import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import deTranslations from '../../public/i18n/de.json';
import enTranslations from '../../public/i18n/en.json';
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

  it('searches and filters drills while preserving filters when returning from drill details', () => {
    const fixture = createEditorFixture();
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

  it('rejects invalid title edits with actionable feedback and keeps valid data', () => {
    const fixture = createEditorFixture();
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
});
