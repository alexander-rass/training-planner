import { Injectable, computed, signal } from '@angular/core';
import { parseTrainingData, TrainingData, TrainingDataValidationError } from './training-data';

@Injectable({ providedIn: 'root' })
export class TrainingDataStore {
  private readonly currentData = signal<TrainingData | null>(null);
  readonly trainingData = this.currentData.asReadonly();

  private readonly initialData = signal<TrainingData | null>(null);
  private readonly sourceJsonText = signal<string | null>(null);
  readonly hasUnsavedChanges = computed(() => {
    const data = this.currentData();
    const initialData = this.initialData();
    return (
      data !== null && initialData !== null && JSON.stringify(data) !== JSON.stringify(initialData)
    );
  });

  load(contents: string): TrainingData {
    const data = parseTrainingData(JSON.parse(contents) as unknown);
    this.currentData.set(data);
    this.initialData.set(data);
    this.sourceJsonText.set(contents);
    return data;
  }

  applyChange(update: (data: TrainingData) => TrainingData): TrainingDataValidationError | null {
    const currentData = this.currentData();
    if (!currentData) {
      throw new Error('Cannot update training data before loading a dataset.');
    }

    const nextData = update(currentData);
    try {
      parseTrainingData(nextData);
    } catch (error) {
      if (!(error instanceof TrainingDataValidationError)) {
        throw error;
      }
      return error;
    }

    this.currentData.set(nextData);
    return null;
  }

  exportContent(): string {
    const data = this.currentData();
    const sourceJsonText = this.sourceJsonText();
    if (!data || sourceJsonText === null) {
      throw new Error('Cannot export training data before loading a dataset.');
    }

    parseTrainingData(data);
    return this.hasUnsavedChanges() ? JSON.stringify(data, null, 2) : sourceJsonText;
  }

  markExported(contents: string): void {
    const data = this.currentData();
    if (!data) {
      throw new Error('Cannot mark training data as exported before loading a dataset.');
    }

    this.sourceJsonText.set(contents);
    this.initialData.set(data);
  }
}
