import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { TrainingDataEditor } from './training-data-editor';
import { TrainingPlanView } from './training-plan-view';
import { TrainingDataValidationError } from './training-data';
import { createJsonDownloadPayload } from './training-data-download';
import { TrainingDataStore } from './training-data-store';
import {
  parseTrainingDatasetCatalog,
  TrainingDatasetCatalogError,
  TrainingDatasetDefinition,
} from './training-datasets';

interface TranslationMessage {
  key: string;
  params?: Record<string, string | number>;
  detail?: TranslationMessage;
}

@Component({
  selector: 'app-root',
  imports: [TrainingDataEditor, TrainingPlanView, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly trainingDataStore = inject(TrainingDataStore);
  private readonly translatedDocumentTitle = this.translate.translate('app.documentTitle');

  protected readonly trainingData = this.trainingDataStore.trainingData;
  protected readonly hasUnsavedChanges = this.trainingDataStore.hasUnsavedChanges;
  protected readonly loadedFileName = signal<string | null>(null);
  protected readonly selectedLocalFileName = signal<string | null>(null);
  protected readonly isEditingData = signal(false);
  protected readonly editorResetToken = signal(0);
  protected readonly loadError = signal<TranslationMessage | null>(null);
  protected readonly datasetCatalogError = signal<TranslationMessage | null>(null);
  protected readonly availableDatasets = signal<TrainingDatasetDefinition[]>([]);
  protected readonly isDatasetCatalogLoading = signal(true);
  protected readonly selectedDatasetId = signal('');
  protected readonly isLoading = signal(false);
  protected readonly planResetToken = signal(0);
  protected readonly planDataChangeToken = signal(0);
  protected readonly currentLanguage = this.translate.currentLang;
  protected readonly languageError = signal<TranslationMessage | null>(null);
  protected readonly downloadError = signal<TranslationMessage | null>(null);
  constructor() {
    this.loadDatasetCatalog();
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
  }

  protected async onDatasetSelected(event: Event): Promise<void> {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const dataset = this.availableDatasets().find((item) => item.id === select.value);
    if (!dataset) {
      select.value = this.selectedDatasetId();
      return;
    }

    await this.loadPreloadedDataset(dataset, select);
  }

  protected async reloadSelectedDataset(): Promise<void> {
    const dataset = this.availableDatasets().find((item) => item.id === this.selectedDatasetId());
    if (dataset) {
      await this.loadPreloadedDataset(dataset);
    }
  }

  private async loadPreloadedDataset(
    dataset: TrainingDatasetDefinition,
    select?: HTMLSelectElement,
  ): Promise<void> {
    if (!this.confirmDataReplacement(dataset.name)) {
      if (select) {
        select.value = this.selectedDatasetId();
      }
      return;
    }

    this.loadError.set(null);
    this.isLoading.set(true);

    try {
      const contents = await firstValueFrom(
        this.http.get(`data/${dataset.fileName}`, { responseType: 'text' }),
      );
      this.applyTrainingData(contents, dataset.fileName, dataset.id);
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) {
        throw error;
      }
      this.loadError.set({
        key: 'datasets.fileLoadFailed',
        params: { name: dataset.name },
      });
    } finally {
      this.isLoading.set(false);
    }
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
    const sourceFileName = this.loadedFileName();
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

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0];
    if (!file) {
      return;
    }
    input.value = '';

    if (!this.confirmDataReplacement(file.name)) {
      return;
    }

    this.selectedLocalFileName.set(file.name);
    this.loadError.set(null);
    this.isLoading.set(true);

    try {
      let contents: string;
      try {
        contents = await file.text();
      } catch {
        this.loadError.set({ key: 'errors.fileRead', params: { fileName: file.name } });
        return;
      }

      this.applyTrainingData(contents, file.name, null);
    } finally {
      this.isLoading.set(false);
    }
  }

  private loadDatasetCatalog(): void {
    this.http.get<unknown>('data/datasets.json').subscribe({
      next: (catalog) => {
        try {
          this.availableDatasets.set(parseTrainingDatasetCatalog(catalog));
        } catch (error) {
          if (!(error instanceof TrainingDatasetCatalogError)) {
            throw error;
          }
          this.datasetCatalogError.set({ key: 'datasets.catalogInvalid' });
        } finally {
          this.isDatasetCatalogLoading.set(false);
        }
      },
      error: (error: unknown) => {
        if (!(error instanceof HttpErrorResponse)) {
          throw error;
        }
        this.datasetCatalogError.set({ key: 'datasets.catalogLoadFailed' });
        this.isDatasetCatalogLoading.set(false);
      },
    });
  }

  private confirmDataReplacement(name: string): boolean {
    if (!this.trainingData()) {
      return true;
    }

    const message = this.translate.instant(
      this.hasUnsavedChanges()
        ? 'datasets.overwriteEditedConfirmation'
        : 'datasets.overwriteConfirmation',
      { name },
    );
    if (typeof message !== 'string') {
      throw new Error('The dataset replacement confirmation must be a string.');
    }
    return typeof window === 'undefined' || window.confirm(message);
  }

  private applyTrainingData(contents: string, fileName: string, datasetId: string | null): void {
    try {
      this.trainingDataStore.load(contents);
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.loadError.set({ key: 'errors.invalidJson', params: { fileName } });
        return;
      }
      if (error instanceof TrainingDataValidationError) {
        this.loadError.set({
          key: 'errors.invalidTrainingData',
          params: { fileName },
          detail: { key: error.translationKey, params: error.params },
        });
        return;
      }
      throw error;
    }

    this.loadedFileName.set(fileName);
    this.selectedLocalFileName.set(datasetId === null ? fileName : null);
    this.selectedDatasetId.set(datasetId ?? '');
    this.isEditingData.set(false);
    this.editorResetToken.update((token) => token + 1);
    this.planResetToken.update((token) => token + 1);
    this.downloadError.set(null);
  }
}
