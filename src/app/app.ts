import { Component, signal } from '@angular/core';
import { parseTrainingData, TrainingData, TrainingDataValidationError } from './training-data';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly trainingData = signal<TrainingData | null>(null);
  protected readonly loadedFileName = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly isLoading = signal(false);

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

    this.loadError.set(null);
    this.isLoading.set(true);

    try {
      let contents: string;
      try {
        contents = await file.text();
      } catch (error) {
        this.loadError.set(`Could not read "${file.name}": ${describeError(error)}`);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(contents) as unknown;
      } catch (error) {
        if (!(error instanceof SyntaxError)) {
          throw error;
        }
        this.loadError.set(`"${file.name}" is not valid JSON: ${error.message}`);
        return;
      }

      let data: TrainingData;
      try {
        data = parseTrainingData(parsed);
      } catch (error) {
        if (!(error instanceof TrainingDataValidationError)) {
          throw error;
        }
        this.loadError.set(`"${file.name}" is not valid training data: ${error.message}`);
        return;
      }

      this.trainingData.set(data);
      this.loadedFileName.set(file.name);
    } finally {
      this.isLoading.set(false);
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
