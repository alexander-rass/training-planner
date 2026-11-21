export interface JsonDownloadPayload {
  fileName: string;
  content: string;
}

export function createJsonDownloadPayload(
  sourceFileName: string,
  sourceContent: string,
): JsonDownloadPayload {
  const baseName = sourceFileName.replace(/\.json$/i, '') || 'training-data';
  return {
    fileName: `${baseName}-export.json`,
    content: sourceContent,
  };
}
