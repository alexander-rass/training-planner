import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const outputDirectory = join('dist', 'training-planner');
const browserDirectory = join(outputDirectory, 'browser');

await Promise.all([
  copyFile('LICENSE', join(browserDirectory, 'LICENSE')),
  copyFile(
    join(outputDirectory, '3rdpartylicenses.txt'),
    join(browserDirectory, '3rdpartylicenses.txt'),
  ),
]);
