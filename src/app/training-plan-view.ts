import {
  Component,
  computed,
  inject,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MarkdownPipe } from './markdown.pipe';
import { Drill, ModificationDefinition, StageDefinition } from './training-data';
import { formatWhatsAppPlan, PlanSlot, StagePlan, whatsAppToMarkdown } from './training-plan';
import { TrainingDataStore } from './training-data-store';

interface TranslationMessage {
  key: string;
  params?: Record<string, string | number>;
}

@Component({
  selector: 'app-training-plan-view',
  imports: [MarkdownPipe, TranslatePipe],
  templateUrl: './training-plan-view.html',
  styleUrl: './training-plan-view.css',
})
export class TrainingPlanView implements OnChanges {
  private readonly trainingDataStore = inject(TrainingDataStore);
  private readonly translate = inject(TranslateService);
  private readonly translatedCoachingPointsLabel =
    this.translate.translate('drills.coachingPoints');

  @Input() isVisible = true;
  @Input() resetToken = 0;
  @Input() dataChangeToken = 0;

  protected readonly trainingData = this.trainingDataStore.trainingData;
  protected readonly selectedLabelIds = signal<ReadonlySet<string>>(new Set());
  protected readonly stagePlans = signal<StagePlan[]>([]);
  protected readonly planError = signal<TranslationMessage | null>(null);
  protected readonly copied = signal(false);
  protected readonly copyError = signal<TranslationMessage | null>(null);
  protected readonly whatsappMessage = computed(() => {
    const data = this.trainingData();
    const translatedLabel = this.translatedCoachingPointsLabel();
    return data
      ? formatWhatsAppPlan(
          data,
          this.stagePlans(),
          typeof translatedLabel === 'string' ? translatedLabel : 'Coaching points',
        )
      : '';
  });
  protected readonly whatsappPreview = computed(() => whatsAppToMarkdown(this.whatsappMessage()));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resetToken']) {
      this.resetPlan();
    } else if (changes['dataChangeToken']) {
      this.reconcileStagePlans();
      this.resetCopyStatus();
    }
  }

  protected stages(): StageDefinition[] {
    const data = this.trainingData();
    return data ? [...data.catalog.stages].sort((a, b) => a.order - b.order) : [];
  }

  protected mainFilterLabels() {
    const data = this.trainingData();
    if (!data) {
      return [];
    }

    const labelsById = new Map(data.catalog.labels.map((label) => [label.id, label]));
    return data.catalog.mainFilterLabelIds
      .map((labelId) => labelsById.get(labelId))
      .filter((label) => label !== undefined);
  }

  protected additionalFilterLabels() {
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
      this.planError.set({ key: 'errors.invalidDrillCount' });
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
    this.resetCopyStatus();
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

  protected async copyWhatsAppMessage(): Promise<void> {
    const message = this.whatsappMessage();
    if (!message) {
      return;
    }

    this.resetCopyStatus();
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      this.copyError.set({ key: 'errors.clipboardUnavailable' });
      return;
    }

    try {
      await navigator.clipboard.writeText(message);
      this.copied.set(true);
    } catch {
      this.copyError.set({ key: 'errors.clipboardFailed' });
    }
  }

  private resetPlan(): void {
    const data = this.trainingData();
    this.selectedLabelIds.set(new Set());
    this.planError.set(null);
    this.stagePlans.set(
      data
        ? [...data.catalog.stages]
            .sort((a, b) => a.order - b.order)
            .map((stage) => ({
              stageId: stage.id,
              slots: Array.from({ length: stage.defaultDrillCount }, createPlanSlot),
            }))
        : [],
    );
    this.resetCopyStatus();
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
    this.resetCopyStatus();
  }

  private reconcileStagePlans(): void {
    const data = this.trainingData();
    if (!data) {
      return;
    }

    const previousPlans = new Map(this.stagePlans().map((plan) => [plan.stageId, plan]));
    const drillsById = new Map(data.drills.map((drill) => [drill.id, drill]));
    const modificationsById = new Map(
      data.catalog.modifications.map((modification) => [modification.id, modification]),
    );
    const labelsById = new Set(data.catalog.labels.map((label) => label.id));

    this.selectedLabelIds.update(
      (selected) => new Set([...selected].filter((labelId) => labelsById.has(labelId))),
    );
    this.stagePlans.set(
      [...data.catalog.stages]
        .sort((a, b) => a.order - b.order)
        .map((stage) => {
          const previousPlan = previousPlans.get(stage.id);
          const slots =
            previousPlan?.slots ?? Array.from({ length: stage.defaultDrillCount }, createPlanSlot);

          return {
            stageId: stage.id,
            slots: slots.map((slot) => {
              if (!slot.drillId) {
                return { drillId: null, modificationSelections: {} };
              }

              const drill = drillsById.get(slot.drillId);
              if (!drill || !drill.availableStageIds.includes(stage.id)) {
                return { drillId: null, modificationSelections: {} };
              }

              const modificationSelections = Object.fromEntries(
                Object.entries(slot.modificationSelections).filter(
                  ([modificationId, optionId]) =>
                    drill.modificationIds.includes(modificationId) &&
                    modificationsById
                      .get(modificationId)
                      ?.options.some((option) => option.id === optionId),
                ),
              );
              return { ...slot, modificationSelections };
            }),
          };
        }),
    );
  }

  private resetCopyStatus(): void {
    this.copied.set(false);
    this.copyError.set(null);
  }
}

function createPlanSlot(): PlanSlot {
  return { drillId: null, modificationSelections: {} };
}
