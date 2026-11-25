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
import {
  Drill,
  LabelDefinition,
  ModificationDefinition,
  StageDefinition,
  TrainingData,
  TrainingDataValidationError,
} from './training-data';
import { ModificationSelectionMapping } from './training-plan';
import { TrainingDataStore } from './training-data-store';
import { TranslationMessage } from './translation-message';

type EditorSection = 'home' | 'drills' | 'stages' | 'labels' | 'modifications';

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
  @Output() readonly dataChanged = new EventEmitter<ModificationSelectionMapping | undefined>();

  protected readonly trainingData = this.trainingDataStore.trainingData;
  protected readonly hasUnsavedChanges = this.trainingDataStore.hasUnsavedChanges;
  protected readonly selectedEditorDrillId = signal<string | null>(null);
  protected readonly editorSection = signal<EditorSection>('home');
  protected readonly editorSearchQuery = signal('');
  protected readonly modificationSearchQuery = signal('');
  protected readonly selectedModificationId = signal<string | null>(null);
  protected readonly editorStageFilterId = signal('');
  protected readonly editorLabelFilterId = signal('');
  protected readonly editorError = signal<TranslationMessage | null>(null);
  protected readonly pendingStageDeletionId = signal<string | null>(null);
  protected readonly stageReassignmentId = signal('');
  protected readonly pendingLabelDeletionId = signal<string | null>(null);
  protected readonly labelReassignmentId = signal('');
  protected readonly pendingModificationDeletionId = signal<string | null>(null);
  protected readonly modificationReassignmentId = signal('');
  protected readonly modificationOptionMappings = signal<Record<string, string>>({});
  protected readonly pendingOptionDeletion = signal<{
    modificationId: string;
    optionId: string;
  } | null>(null);
  protected readonly optionReassignmentId = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resetToken']) {
      this.editorSection.set('home');
      this.selectedEditorDrillId.set(null);
      this.modificationSearchQuery.set('');
      this.selectedModificationId.set(null);
      this.editorSearchQuery.set('');
      this.editorStageFilterId.set('');
      this.editorLabelFilterId.set('');
      this.editorError.set(null);
      this.cancelStageDeletion();
      this.cancelLabelDeletion();
      this.cancelModificationDeletion();
      this.cancelOptionDeletion();
    } else if (changes['isEditing'] && !this.isEditing) {
      this.editorSection.set('home');
      this.selectedEditorDrillId.set(null);
      this.selectedModificationId.set(null);
      this.cancelStageDeletion();
      this.cancelLabelDeletion();
      this.cancelModificationDeletion();
      this.cancelOptionDeletion();
    }
  }

  protected selectedModification(): ModificationDefinition | undefined {
    const selectedId = this.selectedModificationId();
    return this.trainingData()?.catalog.modifications.find(
      (modification) => modification.id === selectedId,
    );
  }

  protected filteredModifications(): ModificationDefinition[] {
    const modifications = this.trainingData()?.catalog.modifications ?? [];
    const query = this.modificationSearchQuery().trim().toLowerCase();
    return modifications.filter((modification) => modification.label.toLowerCase().includes(query));
  }

  protected onModificationSearchChanged(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.modificationSearchQuery.set(input.value);
    }
  }

  protected selectModification(modificationId: string): void {
    if (
      this.trainingData()?.catalog.modifications.some(
        (modification) => modification.id === modificationId,
      )
    ) {
      this.selectedModificationId.set(modificationId);
      this.cancelModificationDeletion();
      this.cancelOptionDeletion();
    }
  }

  protected returnToModificationList(): void {
    this.selectedModificationId.set(null);
    this.cancelModificationDeletion();
    this.cancelOptionDeletion();
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
    if (section !== 'labels') {
      this.cancelLabelDeletion();
    }
    if (section !== 'modifications') {
      this.selectedModificationId.set(null);
      this.cancelModificationDeletion();
      this.cancelOptionDeletion();
    }
  }

  protected returnToEditorHome(): void {
    this.editorSection.set('home');
    this.selectedEditorDrillId.set(null);
    this.cancelStageDeletion();
    this.cancelLabelDeletion();
    this.cancelModificationDeletion();
    this.cancelOptionDeletion();
    this.selectedModificationId.set(null);
  }

  protected addModification(): void {
    const data = this.trainingData();
    if (!data || this.isLoading) {
      return;
    }

    const label = this.translatedString('editor.newModification');
    const optionLabel = this.translatedString('editor.newModificationOption');
    const id = this.nextAvailableId(
      'new-modification',
      data.catalog.modifications.map((item) => item.id),
    );
    const optionId = this.nextAvailableId('new-option', []);
    const applied = this.applyTrainingDataChange((current) => ({
      ...current,
      catalog: {
        ...current.catalog,
        modifications: [
          ...current.catalog.modifications,
          { id, label, type: 'single-select', options: [{ id: optionId, label: optionLabel }] },
        ],
      },
    }));
    if (applied) {
      this.selectedModificationId.set(id);
    }
  }

  protected onModificationLabelChanged(modification: ModificationDefinition, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    if (input.value.trim().length === 0) {
      input.value = modification.label;
      this.editorError.set({ key: 'editor.modificationNameRequired' });
      return;
    }
    if (
      !this.updateModification(modification.id, (current) => ({ ...current, label: input.value }))
    ) {
      input.value = modification.label;
    }
  }

  protected addModificationOption(modification: ModificationDefinition): void {
    if (this.isLoading) {
      return;
    }

    const label = this.translatedString('editor.newModificationOption');
    const optionId = this.nextAvailableId(
      'new-option',
      modification.options.map((option) => option.id),
    );
    this.updateModification(modification.id, (current) => ({
      ...current,
      options: [...current.options, { id: optionId, label }],
    }));
  }

  protected onModificationOptionLabelChanged(
    modification: ModificationDefinition,
    optionId: string,
    event: Event,
  ): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const option = modification.options.find((candidate) => candidate.id === optionId);
    if (!option) {
      input.value = '';
      return;
    }
    if (input.value.trim().length === 0) {
      input.value = option.label;
      this.editorError.set({ key: 'editor.modificationOptionRequired' });
      return;
    }
    if (
      !this.updateModification(modification.id, (current) => ({
        ...current,
        options: current.options.map((candidate) =>
          candidate.id === optionId ? { ...candidate, label: input.value } : candidate,
        ),
      }))
    ) {
      input.value = option.label;
    }
  }

  protected requestDeleteModificationOption(
    modification: ModificationDefinition,
    optionId: string,
  ): void {
    if (this.isLoading || modification.options.length <= 1) {
      return;
    }
    this.cancelModificationDeletion();
    this.pendingOptionDeletion.set({ modificationId: modification.id, optionId });
    this.optionReassignmentId.set('');
  }

  protected onOptionReassignmentChanged(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const pending = this.pendingOptionDeletion();
    const modification = this.trainingData()?.catalog.modifications.find(
      (candidate) => candidate.id === pending?.modificationId,
    );
    const validTarget =
      !select.value ||
      modification?.options.some(
        (option) => option.id === select.value && option.id !== pending?.optionId,
      );
    if (validTarget) {
      this.optionReassignmentId.set(select.value);
    } else {
      select.value = this.optionReassignmentId();
    }
  }

  protected cancelOptionDeletion(): void {
    this.pendingOptionDeletion.set(null);
    this.optionReassignmentId.set('');
  }

  protected confirmDeleteModificationOption(modification: ModificationDefinition): void {
    const pending = this.pendingOptionDeletion();
    if (
      !pending ||
      pending.modificationId !== modification.id ||
      this.isLoading ||
      modification.options.length <= 1
    ) {
      return;
    }

    const option = modification.options.find((candidate) => candidate.id === pending.optionId);
    if (!option) {
      this.cancelOptionDeletion();
      return;
    }
    const replacementOptionId = this.optionReassignmentId();
    if (
      replacementOptionId &&
      !modification.options.some(
        (candidate) => candidate.id === replacementOptionId && candidate.id !== option.id,
      )
    ) {
      this.editorError.set({ key: 'editor.modificationOptionReassignmentUnavailable' });
      return;
    }

    const mapping = replacementOptionId
      ? {
          [modification.id]: {
            targetModificationId: modification.id,
            optionIds: { [option.id]: replacementOptionId },
          },
        }
      : undefined;
    if (
      !this.applyTrainingDataChange(
        (data) => ({
          ...data,
          catalog: {
            ...data.catalog,
            modifications: data.catalog.modifications.map((candidate) =>
              candidate.id === modification.id
                ? {
                    ...candidate,
                    options: candidate.options.filter((item) => item.id !== option.id),
                  }
                : candidate,
            ),
          },
        }),
        mapping,
      )
    ) {
      return;
    }
    this.cancelOptionDeletion();
  }

  protected modificationOptionIsPending(modificationId: string, optionId: string): boolean {
    const pending = this.pendingOptionDeletion();
    return pending?.modificationId === modificationId && pending.optionId === optionId;
  }

  protected drillsUsingModification(modificationId: string): Drill[] {
    return (
      this.trainingData()?.drills.filter((drill) =>
        drill.modificationIds.includes(modificationId),
      ) ?? []
    );
  }

  protected requestDeleteModification(modification: ModificationDefinition): void {
    if (this.isLoading) {
      return;
    }
    this.cancelOptionDeletion();
    this.editorError.set(null);
    this.pendingModificationDeletionId.set(modification.id);
    this.modificationReassignmentId.set('');
    this.modificationOptionMappings.set({});
  }

  protected onModificationReassignmentChanged(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    const modificationId = this.pendingModificationDeletionId();
    const validTarget =
      !select.value ||
      this.trainingData()?.catalog.modifications.some(
        (modification) => modification.id === select.value && modification.id !== modificationId,
      );
    if (validTarget) {
      this.modificationReassignmentId.set(select.value);
      this.modificationOptionMappings.set({});
    } else {
      select.value = this.modificationReassignmentId();
    }
  }

  protected onModificationOptionMappingChanged(optionId: string, event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    this.modificationOptionMappings.update((mappings) => ({
      ...mappings,
      [optionId]: select.value,
    }));
  }

  protected targetModificationOptions(): ModificationDefinition['options'] {
    const targetId = this.modificationReassignmentId();
    return (
      this.trainingData()?.catalog.modifications.find(
        (modification) => modification.id === targetId,
      )?.options ?? []
    );
  }

  protected cancelModificationDeletion(): void {
    this.pendingModificationDeletionId.set(null);
    this.modificationReassignmentId.set('');
    this.modificationOptionMappings.set({});
  }

  protected confirmDeleteModification(modification: ModificationDefinition): void {
    if (this.pendingModificationDeletionId() !== modification.id || this.isLoading) {
      return;
    }

    const targetModificationId = this.modificationReassignmentId();
    const remainingModifications = this.trainingData()?.catalog.modifications.filter(
      (candidate) => candidate.id !== modification.id,
    );
    const targetModification = remainingModifications?.find(
      (candidate) => candidate.id === targetModificationId,
    );
    if (targetModificationId && !targetModification) {
      this.editorError.set({ key: 'editor.modificationReassignmentUnavailable' });
      return;
    }

    const optionIds: Record<string, string> = {};
    if (targetModification) {
      for (const option of modification.options) {
        const targetOptionId = this.modificationOptionMappings()[option.id];
        if (
          targetOptionId &&
          !targetModification.options.some((candidate) => candidate.id === targetOptionId)
        ) {
          this.editorError.set({ key: 'editor.modificationOptionReassignmentUnavailable' });
          return;
        }
        if (targetOptionId) {
          optionIds[option.id] = targetOptionId;
        }
      }
    }

    const mapping: ModificationSelectionMapping | undefined = targetModification
      ? {
          [modification.id]: {
            targetModificationId: targetModification.id,
            optionIds,
          },
        }
      : undefined;
    const applied = this.applyTrainingDataChange(
      (data) => ({
        ...data,
        catalog: {
          ...data.catalog,
          modifications: data.catalog.modifications.filter(
            (candidate) => candidate.id !== modification.id,
          ),
        },
        drills: data.drills.map((drill) => ({
          ...drill,
          modificationIds: this.replaceReferenceId(
            drill.modificationIds,
            modification.id,
            targetModificationId,
          ),
        })),
      }),
      mapping,
    );
    if (applied) {
      this.cancelModificationDeletion();
      this.selectedModificationId.set(null);
    }
  }

  protected onDrillModificationToggled(drill: Drill, modificationId: string, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const modificationIds = input.checked
      ? [...drill.modificationIds, modificationId]
      : drill.modificationIds.filter((id) => id !== modificationId);
    if (!this.updateDrill(drill.id, (current) => ({ ...current, modificationIds }))) {
      input.checked = drill.modificationIds.includes(modificationId);
    }
  }

  protected addLabel(): void {
    const data = this.trainingData();
    if (!data || this.isLoading) {
      return;
    }

    const label = this.translate.instant('editor.newLabel');
    if (typeof label !== 'string') {
      throw new Error('The new label must be a string.');
    }

    const existingIds = new Set(data.catalog.labels.map((candidate) => candidate.id));
    let id = 'new-label';
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `new-label-${suffix}`;
      suffix += 1;
    }

    this.applyTrainingDataChange((current) => ({
      ...current,
      catalog: {
        ...current.catalog,
        labels: [...current.catalog.labels, { id, label }],
      },
    }));
  }

  protected onLabelNameChanged(label: LabelDefinition, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    if (input.value.trim().length === 0) {
      input.value = label.label;
      this.editorError.set({ key: 'editor.labelNameRequired' });
      return;
    }
    if (
      !this.applyTrainingDataChange((data) => ({
        ...data,
        catalog: {
          ...data.catalog,
          labels: data.catalog.labels.map((candidate) =>
            candidate.id === label.id ? { ...candidate, label: input.value } : candidate,
          ),
        },
      }))
    ) {
      input.value = label.label;
    }
  }

  protected onMainFilterLabelToggled(label: LabelDefinition, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    this.applyTrainingDataChange((data) => ({
      ...data,
      catalog: {
        ...data.catalog,
        mainFilterLabelIds: input.checked
          ? data.catalog.mainFilterLabelIds.includes(label.id)
            ? data.catalog.mainFilterLabelIds
            : [...data.catalog.mainFilterLabelIds, label.id]
          : data.catalog.mainFilterLabelIds.filter((id) => id !== label.id),
      },
    }));
  }

  protected drillsUsingLabel(labelId: string): Drill[] {
    return this.trainingData()?.drills.filter((drill) => drill.labelIds.includes(labelId)) ?? [];
  }

  protected requestDeleteLabel(label: LabelDefinition): void {
    if (this.isLoading) {
      return;
    }
    this.editorError.set(null);
    this.pendingLabelDeletionId.set(label.id);
    this.labelReassignmentId.set('');
  }

  protected onLabelReassignmentChanged(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const labelId = this.pendingLabelDeletionId();
    const validTarget =
      !select.value ||
      this.trainingData()?.catalog.labels.some(
        (label) => label.id === select.value && label.id !== labelId,
      );
    if (validTarget) {
      this.labelReassignmentId.set(select.value);
    } else {
      select.value = this.labelReassignmentId();
    }
  }

  protected cancelLabelDeletion(): void {
    this.pendingLabelDeletionId.set(null);
    this.labelReassignmentId.set('');
  }

  protected confirmDeleteLabel(label: LabelDefinition): void {
    if (this.pendingLabelDeletionId() !== label.id || this.isLoading) {
      return;
    }

    const targetLabelId = this.labelReassignmentId();
    const remainingLabels = this.trainingData()?.catalog.labels.filter(
      (candidate) => candidate.id !== label.id,
    );
    if (targetLabelId && !remainingLabels?.some((candidate) => candidate.id === targetLabelId)) {
      this.editorError.set({ key: 'editor.labelReassignmentUnavailable' });
      return;
    }

    const applied = this.applyTrainingDataChange((data) => ({
      ...data,
      catalog: {
        ...data.catalog,
        labels: data.catalog.labels.filter((candidate) => candidate.id !== label.id),
        mainFilterLabelIds: this.replaceReferenceId(
          data.catalog.mainFilterLabelIds,
          label.id,
          targetLabelId,
        ),
      },
      drills: data.drills.map((drill) => ({
        ...drill,
        labelIds: this.replaceReferenceId(drill.labelIds, label.id, targetLabelId),
      })),
    }));
    if (!applied) {
      return;
    }

    if (this.editorLabelFilterId() === label.id) {
      this.editorLabelFilterId.set(targetLabelId);
    }
    this.cancelLabelDeletion();
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
    if (!data || this.isLoading) {
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
      availableStageIds: firstStage ? [firstStage.id] : [],
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

  protected addCoachingPoint(drill: Drill): void {
    if (this.isLoading) {
      return;
    }

    const point = this.translate.instant('editor.newCoachingPoint');
    if (typeof point !== 'string' || point.trim().length === 0) {
      throw new Error('The new coaching point must be a non-empty string.');
    }

    this.updateDrill(drill.id, (current) => ({
      ...current,
      coachingPoints: [...(current.coachingPoints ?? []), point],
    }));
  }

  protected onCoachingPointChanged(drill: Drill, index: number, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLTextAreaElement)) {
      return;
    }

    const currentPoint = this.trainingData()?.drills.find((candidate) => candidate.id === drill.id)
      ?.coachingPoints?.[index];
    if (currentPoint === undefined) {
      input.value = '';
      return;
    }
    if (input.value.trim().length === 0) {
      input.value = currentPoint;
      this.editorError.set({ key: 'editor.coachingPointRequired' });
      return;
    }
    if (
      !this.updateDrill(drill.id, (current) => ({
        ...current,
        coachingPoints: (current.coachingPoints ?? []).map((point, pointIndex) =>
          pointIndex === index ? input.value : point,
        ),
      }))
    ) {
      input.value = currentPoint;
    }
  }

  protected moveCoachingPoint(drill: Drill, index: number, direction: -1 | 1): void {
    const points = [...(drill.coachingPoints ?? [])];
    const destination = index + direction;
    if (
      this.isLoading ||
      index < 0 ||
      index >= points.length ||
      destination < 0 ||
      destination >= points.length
    ) {
      return;
    }

    const point = points[index];
    const destinationPoint = points[destination];
    if (point === undefined || destinationPoint === undefined) {
      return;
    }

    points[index] = destinationPoint;
    points[destination] = point;
    this.updateDrill(drill.id, (current) => ({ ...current, coachingPoints: points }));
  }

  protected deleteCoachingPoint(drill: Drill, index: number): void {
    if (this.isLoading) {
      return;
    }

    this.updateDrill(drill.id, (current) => ({
      ...current,
      coachingPoints: (current.coachingPoints ?? []).filter(
        (_, pointIndex) => pointIndex !== index,
      ),
    }));
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

  private updateModification(
    modificationId: string,
    update: (modification: ModificationDefinition) => ModificationDefinition,
  ): boolean {
    return this.applyTrainingDataChange((data) => ({
      ...data,
      catalog: {
        ...data.catalog,
        modifications: data.catalog.modifications.map((modification) =>
          modification.id === modificationId ? update(modification) : modification,
        ),
      },
    }));
  }

  private translatedString(key: string): string {
    const value = this.translate.instant(key);
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`The translation "${key}" must be a non-empty string.`);
    }
    return value;
  }

  private nextAvailableId(base: string, existingIds: string[]): string {
    const ids = new Set(existingIds);
    let id = base;
    let suffix = 2;
    while (ids.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    return id;
  }

  private replaceReferenceId(ids: string[], removedId: string, replacementId: string): string[] {
    const updatedIds: string[] = [];
    for (const id of ids) {
      const updatedId = id === removedId ? replacementId : id;
      if (updatedId && !updatedIds.includes(updatedId)) {
        updatedIds.push(updatedId);
      }
    }
    return updatedIds;
  }

  private applyTrainingDataChange(
    update: (data: TrainingData) => TrainingData,
    modificationMapping?: ModificationSelectionMapping,
  ): boolean {
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
    this.dataChanged.emit(modificationMapping);
    return true;
  }
}
