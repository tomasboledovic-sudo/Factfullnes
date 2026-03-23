import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');

export function readData(filename) {
    return JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf8'));
}
