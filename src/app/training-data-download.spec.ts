import { createJsonDownloadPayload } from './training-data-download';

describe('createJsonDownloadPayload', () => {
  it('derives an export filename from the dataset name and keeps the JSON text', () => {
    const sourceContent = '{\n  "schemaVersion": 1\n}\n';

    expect(createJsonDownloadPayload('SCA JG 2020', sourceContent)).toEqual({
      fileName: 'SCA-JG-2020-export.json',
      content: sourceContent,
    });
  });

  it('sanitizes filenames and falls back when a name has no filename characters', () => {
    expect(createJsonDownloadPayload('Mädchen Training / U11', '{}').fileName).toBe(
      'Mädchen-Training-U11-export.json',
    );
    expect(createJsonDownloadPayload('***', '{}').fileName).toBe('training-data-export.json');
  });
});
