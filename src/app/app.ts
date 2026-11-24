import { Component, effect, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TrainingDataEditor } from './training-data-editor';
import { TrainingPlanView } from './training-plan-view';
import { TrainingDataValidationError } from './training-data';
import { createJsonDownloadPayload } from './training-data-download';
import { TrainingDataSource } from './training-data-source';
import { TrainingDataStore } from './training-data-store';
import { TranslationMessage } from './translation-message';

@Component({
  selector: 'app-root',
  imports: [TrainingDataEditor, TrainingPlanView, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly translate = inject(TranslateService);
  private readonly trainingDataStore = inject(TrainingDataStore);
  protected readonly dataSource = inject(TrainingDataSource);
  private readonly translatedDocumentTitle = this.translate.translate('app.documentTitle');

  protected readonly trainingData = this.trainingDataStore.trainingData;
  protected readonly hasUnsavedChanges = this.trainingDataStore.hasUnsavedChanges;
  protected readonly isEditingData = signal(false);
  protected readonly planDataChangeToken = signal(0);
  protected readonly currentLanguage = this.translate.currentLang;
  protected readonly languageError = signal<TranslationMessage | null>(null);
  protected readonly downloadError = signal<TranslationMessage | null>(null);
  constructor() {
    effect(() => {
      const title = this.translatedDocumentTitle();
      const language = this.currentLanguage();
      if (typeof document !== 'undefined') {
        if (typeof title === 'string') {
          document.title = title;
        }
        document.documentElement.lang = language ?? 'de';
      }
    });
    effect(() => {
      this.dataSource.dataRevision();
      this.isEditingData.set(false);
      this.downloadError.set(null);
    });
  }

  protected toggleDataEditor(): void {
    this.isEditingData.update((editing) => !editing);
  }

  protected onTrainingDataEdited(): void {
    this.planDataChangeToken.update((token) => token + 1);
    this.downloadError.set(null);
  }

  protected onLanguageSelected(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const language = select.value;
    if (language !== 'de' && language !== 'en') {
      select.value = this.currentLanguage() ?? 'de';
      return;
    }

    this.languageError.set(null);
    this.translate.use(language).subscribe({
      error: () => {
        this.languageError.set({ key: 'language.loadFailed', params: { language } });
        select.value = this.currentLanguage() ?? 'de';
      },
    });
  }

  protected downloadJsonCopy(): void {
    const sourceFileName = this.dataSource.loadedFileName();
    const data = this.trainingData();
    if (!data) {
      return;
    }

    let sourceContent: string;
    try {
      sourceContent = this.trainingDataStore.exportContent();
    } catch (error) {
      if (!(error instanceof TrainingDataValidationError)) {
        throw error;
      }
      this.downloadError.set({
        key: 'editor.exportValidationFailed',
        detail: {
          key: error.translationKey,
          params: error.params,
        },
      });
      return;
    }
    if (!sourceFileName) {
      return;
    }

    this.downloadError.set(null);
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
      this.downloadError.set({ key: 'errors.downloadUnavailable' });
      return;
    }

    const payload = createJsonDownloadPayload(sourceFileName, sourceContent);
    let objectUrl: string | null = null;
    let link: HTMLAnchorElement | null = null;

    try {
      objectUrl = URL.createObjectURL(
        new Blob([payload.content], { type: 'application/json;charset=utf-8' }),
      );
      link = document.createElement('a');
      link.href = objectUrl;
      link.download = payload.fileName;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      this.trainingDataStore.markExported(sourceContent);
    } catch {
      this.downloadError.set({ key: 'errors.downloadFailed' });
    } finally {
      link?.remove();
      if (objectUrl !== null) {
        const urlToRevoke = objectUrl;
        if (typeof window === 'undefined') {
          URL.revokeObjectURL(urlToRevoke);
        } else {
          window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 0);
        }
      }
    }
  }
}
