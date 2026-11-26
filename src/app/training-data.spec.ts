import { parseTrainingData } from './training-data';

const validData = {
  schemaVersion: 1,
  name: 'Passing drills',
  catalog: {
    stages: [
      {
        id: 'warmup',
        label: 'Warm-up',
        order: 1,
        defaultDrillCount: 0,
      },
    ],
    labels: [{ id: 'passing', label: 'Passing' }],
    mainFilterLabelIds: ['passing'],
    modifications: [
      {
        id: 'player-selection',
        label: 'Player selection',
        type: 'single-select',
        options: [{ id: 'line', label: 'Stand in line' }],
      },
    ],
  },
  drills: [
    {
      id: 'drill-001',
      title: 'Passing drill',
      availableStageIds: ['warmup'],
      labelIds: ['passing'],
      descriptionMarkdown: 'Pass and follow your pass.',
      modificationIds: ['player-selection'],
    },
  ],
};

describe('parseTrainingData', () => {
  it('uses a fallback name for legacy data without one', () => {
    const { name: _name, ...legacyData } = validData;

    expect(parseTrainingData(legacyData, 'Imported drills').name).toBe('Imported drills');
  });

  it('rejects a blank dataset name', () => {
    expect(() => parseTrainingData({ ...validData, name: '  ' })).toThrow(
      'validation.nonEmptyString',
    );
  });

  it('accepts valid data and a zero default drill count', () => {
    const data = parseTrainingData(validData);

    expect(data.catalog.stages[0]?.defaultDrillCount).toBe(0);
    expect(data.drills[0]?.title).toBe('Passing drill');
  });

  it('accepts the maximum default drill count and rejects counts above it', () => {
    const atLimit = {
      ...validData,
      catalog: {
        ...validData.catalog,
        stages: [{ ...validData.catalog.stages[0], defaultDrillCount: 100 }],
      },
    };
    expect(parseTrainingData(atLimit).catalog.stages[0]?.defaultDrillCount).toBe(100);

    const overLimit = {
      ...atLimit,
      catalog: {
        ...atLimit.catalog,
        stages: [{ ...atLimit.catalog.stages[0], defaultDrillCount: 101 }],
      },
    };
    expect(() => parseTrainingData(overLimit)).toThrow('validation.drillCountLimit');
  });

  it('accepts a drill with no available stages', () => {
    const data = {
      ...validData,
      drills: [{ ...validData.drills[0], availableStageIds: [] }],
    };

    expect(parseTrainingData(data).drills[0]?.availableStageIds).toEqual([]);
  });

  it('rejects references to unknown labels', () => {
    const data = {
      ...validData,
      catalog: { ...validData.catalog, mainFilterLabelIds: ['unknown'] },
    };

    expect(() => parseTrainingData(data)).toThrow('validation.unknownLabel');
  });

  it('rejects references to unknown stages in drills', () => {
    const data = {
      ...validData,
      drills: [
        {
          ...validData.drills[0],
          availableStageIds: ['unknown'],
        },
      ],
    };

    expect(() => parseTrainingData(data)).toThrow('validation.unknownStage');
  });

  it('rejects negative default drill counts', () => {
    const data = {
      ...validData,
      catalog: {
        ...validData.catalog,
        stages: [{ ...validData.catalog.stages[0], defaultDrillCount: -1 }],
      },
    };

    expect(() => parseTrainingData(data)).toThrow('validation.nonNegativeInteger');
  });
});
