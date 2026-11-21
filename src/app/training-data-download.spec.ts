import { createJsonDownloadPayload } from './training-data-download';

describe('createJsonDownloadPayload', () => {
  it('keeps the original JSON text and creates an export filename', () => {
    const sourceContent = '{\n  "schemaVersion": 1\n}\n';

    expect(createJsonDownloadPayload('sampledata.json', sourceContent)).toEqual({
      fileName: 'sampledata-export.json',
      content: sourceContent,
    });
  });

  it('supports filenames with an uppercase JSON extension', () => {
    expect(createJsonDownloadPayload('training.JSON', '{}').fileName).toBe('training-export.json');
  });
});
