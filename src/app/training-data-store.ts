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

  load(contents: string, fallbackName = 'Training data'): TrainingData {
    const sourceData: unknown = JSON.parse(contents);
    const data = parseTrainingData(sourceData, fallbackName);
    const sourceRecord = asRecord(sourceData);
    this.currentData.set(data);
    this.initialData.set(data);
    this.sourceJsonText.set(
      Object.hasOwn(sourceRecord, 'name')
        ? contents
        : JSON.stringify({ ...sourceRecord, name: data.name }, null, 2),
    );
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
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Validated training data must have an object at the root.');
  }
  return Object.fromEntries(Object.entries(value));
}
