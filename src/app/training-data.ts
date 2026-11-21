export interface TrainingData {
  schemaVersion: 1;
  catalog: TrainingCatalog;
  drills: Drill[];
}

export interface TrainingCatalog {
  stages: StageDefinition[];
  labels: LabelDefinition[];
  mainFilterLabelIds: string[];
  modifications: ModificationDefinition[];
}

export interface StageDefinition {
  id: string;
  label: string;
  order: number;
  defaultDrillCount: number;
}

export interface LabelDefinition {
  id: string;
  label: string;
}

export interface ModificationDefinition {
  id: string;
  label: string;
  type: 'single-select';
  options: ModificationOption[];
}

export interface ModificationOption {
  id: string;
  label: string;
}

export interface Drill {
  id: string;
  title: string;
  availableStageIds: string[];
  labelIds: string[];
  descriptionMarkdown: string;
  coachingPoints?: string[];
  modificationIds: string[];
  diagram?: unknown;
}

export class TrainingDataValidationError extends Error {
  override readonly name = 'TrainingDataValidationError';
}

export function parseTrainingData(value: unknown): TrainingData {
  const root = asRecord(value, 'root');
  if (root['schemaVersion'] !== 1) {
    invalid('schemaVersion', 'must be 1');
  }

  const catalogRecord = asRecord(root['catalog'], 'catalog');
  const stages = asArray(catalogRecord['stages'], 'catalog.stages').map((value, index) => {
    const path = `catalog.stages[${index}]`;
    const stage = asRecord(value, path);
    return {
      id: asNonEmptyString(stage['id'], `${path}.id`),
      label: asNonEmptyString(stage['label'], `${path}.label`),
      order: asPositiveInteger(stage['order'], `${path}.order`),
      defaultDrillCount: asNonNegativeInteger(
        stage['defaultDrillCount'],
        `${path}.defaultDrillCount`,
      ),
    };
  });
  const labels = asArray(catalogRecord['labels'], 'catalog.labels').map((value, index) => {
    const path = `catalog.labels[${index}]`;
    const label = asRecord(value, path);
    return {
      id: asNonEmptyString(label['id'], `${path}.id`),
      label: asNonEmptyString(label['label'], `${path}.label`),
    };
  });
  const mainFilterLabelIds = asStringList(
    catalogRecord['mainFilterLabelIds'],
    'catalog.mainFilterLabelIds',
  );
  const modifications = asArray(catalogRecord['modifications'], 'catalog.modifications').map(
    (value, index) => {
      const path = `catalog.modifications[${index}]`;
      const modification = asRecord(value, path);
      if (modification['type'] !== 'single-select') {
        invalid(`${path}.type`, 'must be "single-select"');
      }

      const options = asArray(modification['options'], `${path}.options`).map(
        (optionValue, optionIndex) => {
          const optionPath = `${path}.options[${optionIndex}]`;
          const option = asRecord(optionValue, optionPath);
          return {
            id: asNonEmptyString(option['id'], `${optionPath}.id`),
            label: asNonEmptyString(option['label'], `${optionPath}.label`),
          };
        },
      );
      if (options.length === 0) {
        invalid(`${path}.options`, 'must contain at least one option');
      }

      assertUniqueIds(
        options.map((option) => option.id),
        `${path}.options`,
      );
      return {
        id: asNonEmptyString(modification['id'], `${path}.id`),
        label: asNonEmptyString(modification['label'], `${path}.label`),
        type: 'single-select' as const,
        options,
      };
    },
  );

  const drills = asArray(root['drills'], 'drills').map((value, index) => {
    const path = `drills[${index}]`;
    const drill = asRecord(value, path);
    const coachingPoints =
      drill['coachingPoints'] === undefined
        ? undefined
        : asStringList(drill['coachingPoints'], `${path}.coachingPoints`);

    return {
      id: asNonEmptyString(drill['id'], `${path}.id`),
      title: asNonEmptyString(drill['title'], `${path}.title`),
      availableStageIds: asStringList(
        drill['availableStageIds'],
        `${path}.availableStageIds`,
        false,
      ),
      labelIds: asStringList(drill['labelIds'], `${path}.labelIds`),
      descriptionMarkdown: asString(drill['descriptionMarkdown'], `${path}.descriptionMarkdown`),
      ...(coachingPoints === undefined ? {} : { coachingPoints }),
      modificationIds: asStringList(drill['modificationIds'], `${path}.modificationIds`),
      ...(Object.hasOwn(drill, 'diagram') ? { diagram: drill['diagram'] } : {}),
    };
  });

  const data: TrainingData = {
    schemaVersion: 1,
    catalog: { stages, labels, mainFilterLabelIds, modifications },
    drills,
  };
  validateReferences(data);
  return data;
}

function validateReferences(data: TrainingData): void {
  assertUniqueIds(
    data.catalog.stages.map((stage) => stage.id),
    'catalog.stages',
  );
  const stageOrders = new Set<number>();
  for (const stage of data.catalog.stages) {
    if (stageOrders.has(stage.order)) {
      invalid('catalog.stages.order', `contains duplicate order "${stage.order}"`);
    }
    stageOrders.add(stage.order);
  }
  assertUniqueIds(
    data.catalog.labels.map((label) => label.id),
    'catalog.labels',
  );
  assertUniqueIds(data.catalog.mainFilterLabelIds, 'catalog.mainFilterLabelIds');
  assertUniqueIds(
    data.catalog.modifications.map((modification) => modification.id),
    'catalog.modifications',
  );
  assertUniqueIds(
    data.drills.map((drill) => drill.id),
    'drills',
  );

  const stageIds = new Set(data.catalog.stages.map((stage) => stage.id));
  const labelIds = new Set(data.catalog.labels.map((label) => label.id));
  const modificationIds = new Set(
    data.catalog.modifications.map((modification) => modification.id),
  );

  for (const [index, labelId] of data.catalog.mainFilterLabelIds.entries()) {
    assertReference(labelIds, labelId, `catalog.mainFilterLabelIds[${index}]`, 'label');
  }

  for (const [index, drill] of data.drills.entries()) {
    assertUniqueIds(drill.availableStageIds, `drills[${index}].availableStageIds`);
    assertUniqueIds(drill.labelIds, `drills[${index}].labelIds`);
    assertUniqueIds(drill.modificationIds, `drills[${index}].modificationIds`);

    for (const [stageIndex, stageId] of drill.availableStageIds.entries()) {
      assertReference(
        stageIds,
        stageId,
        `drills[${index}].availableStageIds[${stageIndex}]`,
        'stage',
      );
    }
    for (const [labelIndex, labelId] of drill.labelIds.entries()) {
      assertReference(labelIds, labelId, `drills[${index}].labelIds[${labelIndex}]`, 'label');
    }
    for (const [modificationIndex, modificationId] of drill.modificationIds.entries()) {
      assertReference(
        modificationIds,
        modificationId,
        `drills[${index}].modificationIds[${modificationIndex}]`,
        'modification',
      );
    }
  }
}

function assertReference(knownIds: Set<string>, id: string, path: string, kind: string): void {
  if (!knownIds.has(id)) {
    invalid(path, `references unknown ${kind} "${id}"`);
  }
}

function assertUniqueIds(ids: string[], path: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      invalid(path, `contains duplicate id "${id}"`);
    }
    seen.add(id);
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    invalid(path, 'must be an object');
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    invalid(path, 'must be an array');
  }
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    invalid(path, 'must be a string');
  }
  return value;
}

function asNonEmptyString(value: unknown, path: string): string {
  const stringValue = asString(value, path);
  if (stringValue.trim().length === 0) {
    invalid(path, 'must not be empty');
  }
  return stringValue;
}

function asStringList(value: unknown, path: string, allowEmpty = true): string[] {
  const list = asArray(value, path).map((item, index) =>
    asNonEmptyString(item, `${path}[${index}]`),
  );
  if (!allowEmpty && list.length === 0) {
    invalid(path, 'must contain at least one item');
  }
  return list;
}

function asPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    invalid(path, 'must be a positive integer');
  }
  return value;
}

function asNonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    invalid(path, 'must be a non-negative integer');
  }
  return value;
}

function invalid(path: string, reason: string): never {
  throw new TrainingDataValidationError(`${path} ${reason}.`);
}
