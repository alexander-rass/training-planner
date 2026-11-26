import { TrainingDataStore } from './training-data-store';
import { TrainingDataValidationError } from './training-data';

const sourceJson = JSON.stringify({
  schemaVersion: 1,
  name: 'Practice session',
  catalog: {
    stages: [{ id: 'warmup', label: 'Warm-up', order: 1, defaultDrillCount: 0 }],
    labels: [],
    mainFilterLabelIds: [],
    modifications: [],
  },
  drills: [
    {
      id: 'drill-001',
      title: 'Passing drill',
      availableStageIds: ['warmup'],
      labelIds: [],
      descriptionMarkdown: '',
      modificationIds: [],
      diagram: { kind: 'future-diagram' },
    },
  ],
});

describe('TrainingDataStore', () => {
  it('loads validated data and preserves the original JSON until an edit is made', () => {
    const store = new TrainingDataStore();

    const data = store.load(sourceJson);

    expect(store.trainingData()).toBe(data);
    expect(data.drills[0]?.diagram).toEqual({ kind: 'future-diagram' });
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(store.exportContent()).toBe(sourceJson);
  });

  it('adds an inferred name when exporting legacy data without one', () => {
    const store = new TrainingDataStore();
    const legacyData = JSON.parse(sourceJson) as Record<string, unknown>;
    delete legacyData['name'];

    store.load(JSON.stringify(legacyData), 'Imported training');

    expect(store.trainingData()?.name).toBe('Imported training');
    expect(JSON.parse(store.exportContent()).name).toBe('Imported training');
    expect(store.hasUnsavedChanges()).toBe(false);
  });

  it('validates updates and retains the previous data when a change is rejected', () => {
    const store = new TrainingDataStore();
    const data = store.load(sourceJson);

    const error = store.applyChange((current) => ({
      ...current,
      drills: current.drills.map((drill) => ({ ...drill, availableStageIds: ['missing-stage'] })),
    }));

    expect(error).toBeInstanceOf(TrainingDataValidationError);
    expect(store.trainingData()).toBe(data);
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(store.exportContent()).toBe(sourceJson);
  });

  it('exports valid edits without marking them as saved', () => {
    const store = new TrainingDataStore();
    store.load(sourceJson);

    const error = store.applyChange((current) => ({
      ...current,
      drills: current.drills.map((drill) => ({ ...drill, title: 'Updated drill' })),
    }));
    expect(error).toBeNull();
    expect(store.hasUnsavedChanges()).toBe(true);

    const exportedContent = store.exportContent();
    expect(JSON.parse(exportedContent).drills[0].title).toBe('Updated drill');
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(store.exportContent()).toBe(exportedContent);
  });

  it('keeps the existing working copy when loading invalid JSON data', () => {
    const store = new TrainingDataStore();
    const data = store.load(sourceJson);

    expect(() => store.load('{"schemaVersion": 1}')).toThrow(TrainingDataValidationError);
    expect(store.trainingData()).toBe(data);
    expect(store.exportContent()).toBe(sourceJson);
  });
});
