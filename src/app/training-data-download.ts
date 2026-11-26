export interface JsonDownloadPayload {
  fileName: string;
  content: string;
}

export function createJsonDownloadPayload(
  datasetName: string,
  sourceContent: string,
): JsonDownloadPayload {
  const baseName = Array.from(
    datasetName
      .normalize('NFKC')
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, ''),
  )
    .slice(0, 80)
    .join('')
    .replace(/-+$/g, '');
  return {
    fileName: `${baseName || 'training-data'}-export.json`,
    content: sourceContent,
  };
}
