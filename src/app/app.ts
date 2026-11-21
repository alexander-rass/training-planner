import { Component, signal } from '@angular/core';
import {
  Drill,
  LabelDefinition,
  ModificationDefinition,
  parseTrainingData,
  StageDefinition,
  TrainingData,
  TrainingDataValidationError,
} from './training-data';

interface PlanSlot {
  drillId: string | null;
  modificationSelections: Record<string, string>;
}

interface StagePlan {
  stageId: string;
  slots: PlanSlot[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly trainingData = signal<TrainingData | null>(null);
  protected readonly loadedFileName = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly planError = signal<string | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly selectedLabelIds = signal<ReadonlySet<string>>(new Set());
  protected readonly stagePlans = signal<StagePlan[]>([]);

  protected stages(): StageDefinition[] {
    const data = this.trainingData();
    return data ? [...data.catalog.stages].sort((a, b) => a.order - b.order) : [];
  }

  protected mainFilterLabels(): LabelDefinition[] {
    const data = this.trainingData();
    if (!data) {
      return [];
    }

    const labelsById = new Map(data.catalog.labels.map((label) => [label.id, label]));
    return data.catalog.mainFilterLabelIds
      .map((labelId) => labelsById.get(labelId))
      .filter((label): label is LabelDefinition => label !== undefined);
  }

  protected additionalFilterLabels(): LabelDefinition[] {
    const data = this.trainingData();
    if (!data) {
      return [];
    }

    const mainFilterIds = new Set(data.catalog.mainFilterLabelIds);
    return data.catalog.labels.filter((label) => !mainFilterIds.has(label.id));
  }

  protected isLabelSelected(labelId: string): boolean {
    return this.selectedLabelIds().has(labelId);
  }

  protected toggleLabel(labelId: string): void {
    this.selectedLabelIds.update((selected) => {
      const next = new Set(selected);
      if (next.has(labelId)) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }
      return next;
    });
  }

  protected clearLabelFilters(): void {
    this.selectedLabelIds.set(new Set());
  }

  protected slotsForStage(stageId: string): PlanSlot[] {
    return this.stagePlans().find((plan) => plan.stageId === stageId)?.slots ?? [];
  }

  protected selectableDrills(stageId: string, selectedDrillId: string | null): Drill[] {
    const data = this.trainingData();
    if (!data) {
      return [];
    }

    const selectedLabels = this.selectedLabelIds();
    return data.drills.filter(
      (drill) =>
        drill.availableStageIds.includes(stageId) &&
        (drill.id === selectedDrillId ||
          [...selectedLabels].every((labelId) => drill.labelIds.includes(labelId))),
    );
  }

  protected drillForSlot(slot: PlanSlot): Drill | undefined {
    return this.trainingData()?.drills.find((drill) => drill.id === slot.drillId);
  }

  protected modificationsForDrill(drill: Drill): ModificationDefinition[] {
    const modifications = this.trainingData()?.catalog.modifications ?? [];
    const modificationsById = new Map(
      modifications.map((modification) => [modification.id, modification]),
    );
    return drill.modificationIds
      .map((modificationId) => modificationsById.get(modificationId))
      .filter((modification): modification is ModificationDefinition => modification !== undefined);
  }

  protected onDrillCountChanged(stageId: string, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const count = Number(input.value);
    const currentSlots = this.slotsForStage(stageId);
    if (!Number.isSafeInteger(count) || count < 0) {
      input.value = String(currentSlots.length);
      this.planError.set('Enter a non-negative whole number of drills.');
      return;
    }

    this.planError.set(null);
    const nextSlots = currentSlots.slice(0, count);
    while (nextSlots.length < count) {
      nextSlots.push(createPlanSlot());
    }
    this.stagePlans.update((plans) =>
      plans.map((plan) => (plan.stageId === stageId ? { ...plan, slots: nextSlots } : plan)),
    );
  }

  protected onDrillSelected(stageId: string, slotIndex: number, event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const selectedId = select.value || null;
    if (selectedId !== null) {
      const drill = this.trainingData()?.drills.find(
        (candidate) => candidate.id === selectedId && candidate.availableStageIds.includes(stageId),
      );
      if (!drill) {
        return;
      }
    }

    this.updatePlanSlot(stageId, slotIndex, () => ({
      drillId: selectedId,
      modificationSelections: {},
    }));
  }

  protected onModificationSelected(
    stageId: string,
    slotIndex: number,
    modification: ModificationDefinition,
    event: Event,
  ): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const optionId = select.value;
    if (optionId && !modification.options.some((option) => option.id === optionId)) {
      return;
    }

    this.updatePlanSlot(stageId, slotIndex, (slot) => {
      const modificationSelections = { ...slot.modificationSelections };
      if (optionId) {
        modificationSelections[modification.id] = optionId;
      } else {
        delete modificationSelections[modification.id];
      }
      return { ...slot, modificationSelections };
    });
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
      this.selectedLabelIds.set(new Set());
      this.planError.set(null);
      this.stagePlans.set(
        [...data.catalog.stages]
          .sort((a, b) => a.order - b.order)
          .map((stage) => ({
            stageId: stage.id,
            slots: Array.from({ length: stage.defaultDrillCount }, createPlanSlot),
          })),
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  private updatePlanSlot(
    stageId: string,
    slotIndex: number,
    update: (slot: PlanSlot) => PlanSlot,
  ): void {
    this.stagePlans.update((plans) =>
      plans.map((plan) =>
        plan.stageId === stageId
          ? {
              ...plan,
              slots: plan.slots.map((slot, index) => (index === slotIndex ? update(slot) : slot)),
            }
          : plan,
      ),
    );
  }
}

function createPlanSlot(): PlanSlot {
  return { drillId: null, modificationSelections: {} };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
