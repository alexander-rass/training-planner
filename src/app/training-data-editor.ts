import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MarkdownDescriptionEditor } from './markdown-description-editor';
import { Drill, StageDefinition, TrainingData, TrainingDataValidationError } from './training-data';
import { TrainingDataStore } from './training-data-store';
import { TranslationMessage } from './translation-message';

type EditorSection = 'home' | 'drills' | 'stages';

@Component({
  selector: 'app-training-data-editor',
  imports: [MarkdownDescriptionEditor, TranslatePipe],
  templateUrl: './training-data-editor.html',
})
export class TrainingDataEditor implements OnChanges {
  private readonly trainingDataStore = inject(TrainingDataStore);
  private readonly translate = inject(TranslateService);

  @Input() isEditing = false;
  @Input() isLoading = false;
  @Input() resetToken = 0;
  @Output() readonly dataChanged = new EventEmitter<void>();

  protected readonly trainingData = this.trainingDataStore.trainingData;
  protected readonly hasUnsavedChanges = this.trainingDataStore.hasUnsavedChanges;
  protected readonly selectedEditorDrillId = signal<string | null>(null);
  protected readonly editorSection = signal<EditorSection>('home');
  protected readonly editorSearchQuery = signal('');
  protected readonly editorStageFilterId = signal('');
  protected readonly editorLabelFilterId = signal('');
  protected readonly editorError = signal<TranslationMessage | null>(null);
  protected readonly pendingStageDeletionId = signal<string | null>(null);
  protected readonly stageReassignmentId = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resetToken']) {
      this.editorSection.set('home');
      this.selectedEditorDrillId.set(null);
      this.editorSearchQuery.set('');
      this.editorStageFilterId.set('');
      this.editorLabelFilterId.set('');
      this.editorError.set(null);
      this.cancelStageDeletion();
    } else if (changes['isEditing'] && !this.isEditing) {
      this.editorSection.set('home');
      this.selectedEditorDrillId.set(null);
      this.cancelStageDeletion();
    }
  }

  protected stages(): StageDefinition[] {
    const data = this.trainingData();
    return data ? [...data.catalog.stages].sort((a, b) => a.order - b.order) : [];
  }

  protected editorDrill(): Drill | undefined {
    const selectedId = this.selectedEditorDrillId();
    return this.trainingData()?.drills.find((drill) => drill.id === selectedId);
  }

  protected filteredEditorDrills(): Drill[] {
    const data = this.trainingData();
    if (!data) {
      return [];
    }

    const query = this.editorSearchQuery().trim().toLowerCase();
    const stageId = this.editorStageFilterId();
    const labelId = this.editorLabelFilterId();
    const labelsById = new Map(data.catalog.labels.map((label) => [label.id, label.label]));
    return data.drills.filter(
      (drill) =>
        (!query ||
          [
            drill.title,
            drill.descriptionMarkdown,
            ...(drill.coachingPoints ?? []),
            ...drill.labelIds.map((id) => labelsById.get(id) ?? ''),
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)) &&
        (!stageId || drill.availableStageIds.includes(stageId)) &&
        (!labelId || drill.labelIds.includes(labelId)),
    );
  }

  protected onEditorSearchChanged(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.editorSearchQuery.set(input.value);
    }
  }

  protected onEditorStageFilterChanged(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const stageId = select.value;
    if (!stageId || this.trainingData()?.catalog.stages.some((stage) => stage.id === stageId)) {
      this.editorStageFilterId.set(stageId);
    } else {
      select.value = this.editorStageFilterId();
    }
  }

  protected onEditorLabelFilterChanged(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const labelId = select.value;
    if (!labelId || this.trainingData()?.catalog.labels.some((label) => label.id === labelId)) {
      this.editorLabelFilterId.set(labelId);
    } else {
      select.value = this.editorLabelFilterId();
    }
  }

  protected clearEditorFilters(): void {
    this.editorSearchQuery.set('');
    this.editorStageFilterId.set('');
    this.editorLabelFilterId.set('');
  }

  protected openEditorSection(section: Exclude<EditorSection, 'home'>): void {
    if (this.isLoading) {
      return;
    }

    this.editorError.set(null);
    this.selectedEditorDrillId.set(null);
    this.editorSection.set(section);
    if (section !== 'stages') {
      this.cancelStageDeletion();
    }
  }

  protected returnToEditorHome(): void {
    this.editorSection.set('home');
    this.selectedEditorDrillId.set(null);
    this.cancelStageDeletion();
  }

  protected addStage(): void {
    const data = this.trainingData();
    if (!data || this.isLoading) {
      return;
    }

    const label = this.translate.instant('editor.newStageLabel');
    if (typeof label !== 'string') {
      throw new Error('The new stage label must be a string.');
    }

    const stages = this.stages().map((stage, index) => ({ ...stage, order: index + 1 }));
    const existingIds = new Set(stages.map((stage) => stage.id));
    let id = 'new-stage';
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `new-stage-${suffix}`;
      suffix += 1;
    }

    this.applyTrainingDataChange((current) => ({
      ...current,
      catalog: {
        ...current.catalog,
        stages: [...stages, { id, label, order: stages.length + 1, defaultDrillCount: 1 }],
      },
    }));
  }

  protected onStageLabelChanged(stage: StageDefinition, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    if (input.value.trim().length === 0) {
      input.value = stage.label;
      this.editorError.set({ key: 'editor.stageLabelRequired' });
      return;
    }
    if (!this.updateStage(stage.id, (current) => ({ ...current, label: input.value }))) {
      input.value = stage.label;
    }
  }

  protected onStageDefaultDrillCountChanged(stage: StageDefinition, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const count = Number(input.value);
    if (!input.value.trim() || !Number.isSafeInteger(count) || count < 0) {
      input.value = String(stage.defaultDrillCount);
      this.editorError.set({ key: 'editor.invalidStageDrillCount' });
      return;
    }
    if (!this.updateStage(stage.id, (current) => ({ ...current, defaultDrillCount: count }))) {
      input.value = String(stage.defaultDrillCount);
    }
  }

  protected moveStage(stageId: string, direction: -1 | 1): void {
    const stages = this.stages();
    const index = stages.findIndex((stage) => stage.id === stageId);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= stages.length || this.isLoading) {
      return;
    }

    [stages[index], stages[destination]] = [stages[destination], stages[index]];
    const reorderedStages = stages.map((stage, order) => ({ ...stage, order: order + 1 }));
    this.applyTrainingDataChange((data) => ({
      ...data,
      catalog: { ...data.catalog, stages: reorderedStages },
    }));
  }

  protected drillsUsingStage(stageId: string): Drill[] {
    return (
      this.trainingData()?.drills.filter((drill) => drill.availableStageIds.includes(stageId)) ?? []
    );
  }

  protected requestDeleteStage(stage: StageDefinition): void {
    if (this.isLoading) {
      return;
    }
    this.editorError.set(null);
    this.pendingStageDeletionId.set(stage.id);
    this.stageReassignmentId.set('');
  }

  protected onStageReassignmentChanged(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const stageId = this.pendingStageDeletionId();
    const validTarget =
      !select.value ||
      this.trainingData()?.catalog.stages.some(
        (stage) => stage.id === select.value && stage.id !== stageId,
      );
    if (validTarget) {
      this.stageReassignmentId.set(select.value);
    } else {
      select.value = this.stageReassignmentId();
    }
  }

  protected cancelStageDeletion(): void {
    this.pendingStageDeletionId.set(null);
    this.stageReassignmentId.set('');
  }

  protected confirmDeleteStage(stage: StageDefinition): void {
    if (this.pendingStageDeletionId() !== stage.id || this.isLoading) {
      return;
    }

    const targetStageId = this.stageReassignmentId();
    const remainingStages = this.stages()
      .filter((candidate) => candidate.id !== stage.id)
      .map((candidate, index) => ({ ...candidate, order: index + 1 }));
    if (targetStageId && !remainingStages.some((candidate) => candidate.id === targetStageId)) {
      this.editorError.set({ key: 'editor.stageReassignmentUnavailable' });
      return;
    }

    const applied = this.applyTrainingDataChange((data) => ({
      ...data,
      catalog: { ...data.catalog, stages: remainingStages },
      drills: data.drills.map((drill) => {
        if (!drill.availableStageIds.includes(stage.id)) {
          return drill;
        }

        const availableStageIds = drill.availableStageIds.filter((id) => id !== stage.id);
        if (targetStageId && !availableStageIds.includes(targetStageId)) {
          availableStageIds.push(targetStageId);
        }
        return { ...drill, availableStageIds };
      }),
    }));
    if (!applied) {
      return;
    }

    if (this.editorStageFilterId() === stage.id) {
      this.editorStageFilterId.set('');
    }
    this.cancelStageDeletion();
  }

  protected returnToDrillSearch(): void {
    this.selectedEditorDrillId.set(null);
  }

  protected selectEditorDrill(drillId: string): void {
    if (this.trainingData()?.drills.some((drill) => drill.id === drillId)) {
      this.selectedEditorDrillId.set(drillId);
    }
  }

  protected addDrill(): void {
    const data = this.trainingData();
    const firstStage = this.stages()[0];
    if (!data || !firstStage) {
      return;
    }

    const title = this.translate.instant('editor.newDrillTitle');
    if (typeof title !== 'string') {
      throw new Error('The new drill title must be a string.');
    }

    const existingIds = new Set(data.drills.map((drill) => drill.id));
    let id = 'new-drill';
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `new-drill-${suffix}`;
      suffix += 1;
    }

    const drill: Drill = {
      id,
      title,
      availableStageIds: [firstStage.id],
      labelIds: [],
      descriptionMarkdown: '',
      modificationIds: [],
    };
    if (
      !this.applyTrainingDataChange((current) => ({
        ...current,
        drills: [...current.drills, drill],
      }))
    ) {
      return;
    }
    this.selectedEditorDrillId.set(drill.id);
    this.clearEditorFilters();
  }

  protected confirmDeleteDrill(drill: Drill): void {
    const message = this.translate.instant('editor.deleteDrillConfirmation', {
      title: drill.title,
    });
    if (typeof message !== 'string') {
      throw new Error('The drill deletion confirmation must be a string.');
    }
    if (typeof window !== 'undefined' && !window.confirm(message)) {
      return;
    }

    if (
      !this.applyTrainingDataChange((data) => ({
        ...data,
        drills: data.drills.filter((candidate) => candidate.id !== drill.id),
      }))
    ) {
      return;
    }

    this.selectedEditorDrillId.set(null);
  }

  protected onDrillTitleChanged(drillId: string, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    if (input.value.trim().length === 0) {
      input.value = this.trainingData()?.drills.find((drill) => drill.id === drillId)?.title ?? '';
      this.editorError.set({ key: 'editor.titleRequired' });
      return;
    }
    if (!this.updateDrill(drillId, (drill) => ({ ...drill, title: input.value }))) {
      input.value = this.trainingData()?.drills.find((drill) => drill.id === drillId)?.title ?? '';
    }
  }

  protected onDrillDescriptionChanged(drillId: string, markdown: string): void {
    this.updateDrill(drillId, (drill) => ({ ...drill, descriptionMarkdown: markdown }));
  }

  protected onDescriptionFormattingFailed(): void {
    this.editorError.set({ key: 'editor.formattingFailed' });
  }

  protected onDrillStageToggled(drill: Drill, stageId: string, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const availableStageIds = input.checked
      ? [...drill.availableStageIds, stageId]
      : drill.availableStageIds.filter((id) => id !== stageId);
    if (!this.updateDrill(drill.id, (current) => ({ ...current, availableStageIds }))) {
      input.checked = drill.availableStageIds.includes(stageId);
    }
  }

  protected onDrillLabelToggled(drill: Drill, labelId: string, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const labelIds = input.checked
      ? [...drill.labelIds, labelId]
      : drill.labelIds.filter((id) => id !== labelId);
    if (!this.updateDrill(drill.id, (current) => ({ ...current, labelIds }))) {
      input.checked = drill.labelIds.includes(labelId);
    }
  }

  private updateDrill(drillId: string, update: (drill: Drill) => Drill): boolean {
    return this.applyTrainingDataChange((data) => ({
      ...data,
      drills: data.drills.map((drill) => (drill.id === drillId ? update(drill) : drill)),
    }));
  }

  private updateStage(
    stageId: string,
    update: (stage: StageDefinition) => StageDefinition,
  ): boolean {
    return this.applyTrainingDataChange((data) => ({
      ...data,
      catalog: {
        ...data.catalog,
        stages: data.catalog.stages.map((stage) => (stage.id === stageId ? update(stage) : stage)),
      },
    }));
  }

  private applyTrainingDataChange(update: (data: TrainingData) => TrainingData): boolean {
    const validationError = this.trainingDataStore.applyChange(update);
    if (validationError) {
      this.editorError.set({
        key: 'editor.changeRejected',
        detail: {
          key: validationError.translationKey,
          params: validationError.params,
        },
      });
      return false;
    }

    this.editorError.set(null);
    this.dataChanged.emit();
    return true;
  }
}
