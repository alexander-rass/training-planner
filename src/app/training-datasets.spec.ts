import { parseTrainingDatasetCatalog, TrainingDatasetCatalogError } from './training-datasets';

describe('parseTrainingDatasetCatalog', () => {
  it('accepts a versioned catalog with relative JSON filenames', () => {
    expect(
      parseTrainingDatasetCatalog({
        schemaVersion: 1,
        datasets: [{ id: 'sca-jg-2020', name: 'SCA JG 2020', fileName: 'sca_jg2020_data.json' }],
      }),
    ).toEqual([{ id: 'sca-jg-2020', name: 'SCA JG 2020', fileName: 'sca_jg2020_data.json' }]);
  });

  it('rejects file paths and duplicate dataset IDs', () => {
    expect(() =>
      parseTrainingDatasetCatalog({
        schemaVersion: 1,
        datasets: [{ id: 'outside', name: 'Outside', fileName: '../outside.json' }],
      }),
    ).toThrow(TrainingDatasetCatalogError);

    expect(() =>
      parseTrainingDatasetCatalog({
        schemaVersion: 1,
        datasets: [
          { id: 'duplicate', name: 'First', fileName: 'first.json' },
          { id: 'duplicate', name: 'Second', fileName: 'second.json' },
        ],
      }),
    ).toThrow(TrainingDatasetCatalogError);
  });
});
