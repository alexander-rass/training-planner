import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { TrainingDataValidationError } from './training-data';
import { TrainingDataStore } from './training-data-store';
import {
  parseTrainingDatasetCatalog,
  TrainingDatasetCatalogError,
  TrainingDatasetDefinition,
} from './training-datasets';
import { TranslationMessage } from './translation-message';

@Injectable({ providedIn: 'root' })
export class TrainingDataSource {
  private static readonly newDatasetFileName = 'new-training-data.json';
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly trainingDataStore = inject(TrainingDataStore);

  readonly loadedFileName = signal<string | null>(null);
  readonly selectedLocalFileName = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly availableDatasets = signal<TrainingDatasetDefinition[]>([]);
  readonly isDatasetCatalogLoading = signal(true);
  readonly selectedDatasetId = signal('');
  readonly isNewDataset = signal(false);
  readonly loadError = signal<TranslationMessage | null>(null);
  readonly datasetCatalogError = signal<TranslationMessage | null>(null);
  readonly dataRevision = signal(0);

  constructor() {
    this.loadDatasetCatalog();
  }

  createBlankDataset(): void {
    if (this.trainingDataStore.trainingData()) {
      throw new Error('Cannot create a blank dataset while training data is already loaded.');
    }

    const contents = JSON.stringify(
      {
        schemaVersion: 1,
        catalog: {
          stages: [],
          labels: [],
          mainFilterLabelIds: [],
          modifications: [],
        },
        drills: [],
      },
      null,
      2,
    );
    this.applyTrainingData(contents, TrainingDataSource.newDatasetFileName, null, true);
  }

  async onDatasetSelected(event: Event): Promise<void> {
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

  async reloadSelectedDataset(): Promise<void> {
    const dataset = this.availableDatasets().find((item) => item.id === this.selectedDatasetId());
    if (dataset) {
      await this.loadPreloadedDataset(dataset);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
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
    if (!this.trainingDataStore.trainingData()) {
      return true;
    }

    const message = this.translate.instant(
      this.trainingDataStore.hasUnsavedChanges()
        ? 'datasets.overwriteEditedConfirmation'
        : 'datasets.overwriteConfirmation',
      { name },
    );
    if (typeof message !== 'string') {
      throw new Error('The dataset replacement confirmation must be a string.');
    }
    return typeof window === 'undefined' || window.confirm(message);
  }

  private applyTrainingData(
    contents: string,
    fileName: string,
    datasetId: string | null,
    isNewDataset = false,
  ): void {
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
    this.isNewDataset.set(isNewDataset);
    this.loadError.set(null);
    this.dataRevision.update((revision) => revision + 1);
  }
}
