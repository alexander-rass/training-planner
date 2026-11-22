export interface TrainingDatasetDefinition {
  id: string;
  name: string;
  fileName: string;
}

export class TrainingDatasetCatalogError extends Error {
  override readonly name = 'TrainingDatasetCatalogError';
}

export function parseTrainingDatasetCatalog(value: unknown): TrainingDatasetDefinition[] {
  if (!isRecord(value) || value['schemaVersion'] !== 1 || !Array.isArray(value['datasets'])) {
    throw new TrainingDatasetCatalogError('Invalid training dataset catalog.');
  }

  const seenIds = new Set<string>();
  return value['datasets'].map((entry) => {
    if (!isRecord(entry)) {
      throw new TrainingDatasetCatalogError('Dataset entry must be an object.');
    }

    const id = nonEmptyString(entry['id']);
    const name = nonEmptyString(entry['name']);
    const fileName = nonEmptyString(entry['fileName']);
    if (!id || !name || !fileName || !/^[\w.-]+\.json$/.test(fileName)) {
      throw new TrainingDatasetCatalogError('Dataset entry has invalid fields.');
    }
    if (seenIds.has(id)) {
      throw new TrainingDatasetCatalogError(`Duplicate dataset ID "${id}".`);
    }

    seenIds.add(id);
    return { id, name, fileName };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
