import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { MarkdownPipe } from './markdown.pipe';
import {
  Drill,
  LabelDefinition,
  ModificationDefinition,
  StageDefinition,
  TrainingData,
  TrainingDataValidationError,
} from './training-data';
import { formatWhatsAppPlan, PlanSlot, StagePlan, whatsAppToMarkdown } from './training-plan';
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
  imports: [MarkdownPipe, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly trainingDataStore = inject(TrainingDataStore);
  private readonly translatedDocumentTitle = this.translate.translate('app.documentTitle');
  private readonly translatedCoachingPointsLabel =
    this.translate.translate('drills.coachingPoints');

  protected readonly trainingData = this.trainingDataStore.trainingData;
  protected readonly hasUnsavedChanges = this.trainingDataStore.hasUnsavedChanges;
  protected readonly loadedFileName = signal<string | null>(null);
  protected readonly selectedLocalFileName = signal<string | null>(null);
  protected readonly isEditingData = signal(false);
  protected readonly selectedEditorDrillId = signal<string | null>(null);
  protected readonly editorSearchQuery = signal('');
  protected readonly editorStageFilterId = signal('');
  protected readonly editorLabelFilterId = signal('');
  protected readonly editorError = signal<TranslationMessage | null>(null);
  protected readonly loadError = signal<TranslationMessage | null>(null);
  protected readonly datasetCatalogError = signal<TranslationMessage | null>(null);
  protected readonly availableDatasets = signal<TrainingDatasetDefinition[]>([]);
  protected readonly isDatasetCatalogLoading = signal(true);
  protected readonly selectedDatasetId = signal('');
  protected readonly planError = signal<TranslationMessage | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly selectedLabelIds = signal<ReadonlySet<string>>(new Set());
  protected readonly stagePlans = signal<StagePlan[]>([]);
  protected readonly currentLanguage = this.translate.currentLang;
  protected readonly languageError = signal<TranslationMessage | null>(null);
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
  protected readonly copied = signal(false);
  protected readonly copyError = signal<TranslationMessage | null>(null);
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

  protected toggleDataEditor(): void {
    this.isEditingData.update((editing) => !editing);
    this.selectedEditorDrillId.set(null);
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

    this.stagePlans.update((plans) =>
      plans.map((plan) => ({
        ...plan,
        slots: plan.slots.map((slot) =>
          slot.drillId === drill.id ? { drillId: null, modificationSelections: {} } : slot,
        ),
      })),
    );
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
      return;
    }
    this.stagePlans.update((plans) =>
      plans.map((plan) => ({
        ...plan,
        slots: plan.slots.map((slot) =>
          slot.drillId === drill.id && !availableStageIds.includes(plan.stageId)
            ? { drillId: null, modificationSelections: {} }
            : slot,
        ),
      })),
    );
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
    this.downloadError.set(null);
    this.resetCopyStatus();
    return true;
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

    const data = this.trainingData();
    if (!data) {
      throw new Error('Training data was loaded but not available in the store.');
    }
    this.loadedFileName.set(fileName);
    this.selectedLocalFileName.set(datasetId === null ? fileName : null);
    this.selectedDatasetId.set(datasetId ?? '');
    this.selectedEditorDrillId.set(null);
    this.isEditingData.set(false);
    this.editorError.set(null);
    this.editorSearchQuery.set('');
    this.editorStageFilterId.set('');
    this.editorLabelFilterId.set('');
    this.downloadError.set(null);
    this.selectedLabelIds.set(new Set());
    this.planError.set(null);
    this.resetCopyStatus();
    this.stagePlans.set(
      [...data.catalog.stages]
        .sort((a, b) => a.order - b.order)
        .map((stage) => ({
          stageId: stage.id,
          slots: Array.from({ length: stage.defaultDrillCount }, createPlanSlot),
        })),
    );
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

  private resetCopyStatus(): void {
    this.copied.set(false);
    this.copyError.set(null);
  }
}

function createPlanSlot(): PlanSlot {
  return { drillId: null, modificationSelections: {} };
}
