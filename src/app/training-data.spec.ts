import { parseTrainingData } from './training-data';

const validData = {
  schemaVersion: 1,
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
  it('accepts valid data and a zero default drill count', () => {
    const data = parseTrainingData(validData);

    expect(data.catalog.stages[0]?.defaultDrillCount).toBe(0);
    expect(data.drills[0]?.title).toBe('Passing drill');
  });

  it('rejects references to unknown labels', () => {
    const data = {
      ...validData,
      catalog: { ...validData.catalog, mainFilterLabelIds: ['unknown'] },
    };

    expect(() => parseTrainingData(data)).toThrow(
      'catalog.mainFilterLabelIds[0] references unknown label "unknown".',
    );
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

    expect(() => parseTrainingData(data)).toThrow(
      'drills[0].availableStageIds[0] references unknown stage "unknown".',
    );
  });

  it('rejects negative default drill counts', () => {
    const data = {
      ...validData,
      catalog: {
        ...validData.catalog,
        stages: [{ ...validData.catalog.stages[0], defaultDrillCount: -1 }],
      },
    };

    expect(() => parseTrainingData(data)).toThrow(
      'catalog.stages[0].defaultDrillCount must be a non-negative integer.',
    );
  });
});
