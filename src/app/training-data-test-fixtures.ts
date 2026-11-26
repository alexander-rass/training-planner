export const trainingDataJson = JSON.stringify({
  schemaVersion: 1,
  name: 'SCA JG 2020',
  catalog: {
    stages: [{ id: 'warmup', label: 'Warm-up', order: 1, defaultDrillCount: 1 }],
    labels: [
      { id: 'passing', label: 'Passing' },
      { id: 'u11', label: 'U11' },
    ],
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
      title: 'Passing for U11',
      availableStageIds: ['warmup'],
      labelIds: ['passing', 'u11'],
      descriptionMarkdown: 'Pass and **follow your pass**.',
      coachingPoints: ['Keep **moving**.'],
      modificationIds: ['player-selection'],
      diagram: { kind: 'future-diagram' },
    },
    {
      id: 'drill-002',
      title: 'Passing drill',
      availableStageIds: ['warmup'],
      labelIds: ['passing'],
      descriptionMarkdown: 'Pass to a teammate.',
      modificationIds: [],
    },
  ],
});

export const trainingDatasetCatalog = {
  schemaVersion: 1,
  datasets: [{ id: 'sca-jg-2020', name: 'SCA JG 2020', fileName: 'sca_jg2020_data.json' }],
};
