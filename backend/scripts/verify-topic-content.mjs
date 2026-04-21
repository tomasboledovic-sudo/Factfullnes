/**
 * Kontrola konzistencie: topics.json ↔ preTestQuestions.json ↔ preGeneratedLearning súbory.
 * Spustenie: node backend/scripts/verify-topic-content.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { TOPIC_FILE_NAMES } from '../utils/preGeneratedLearning.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');
const preDir = join(dataDir, 'preGeneratedLearning');

const topics = JSON.parse(readFileSync(join(dataDir, 'topics.json'), 'utf8'));
const preTest = JSON.parse(readFileSync(join(dataDir, 'preTestQuestions.json'), 'utf8'));

let errors = 0;
const topicIds = topics.map((t) => t.id);

for (const id of topicIds) {
    const key = String(id);
    const qs = preTest[key];
    if (!Array.isArray(qs) || qs.length === 0) {
        console.error(`CHYBA: téma ${id} nemá vstupné otázky v preTestQuestions.json`);
        errors++;
        continue;
    }
    for (const q of qs) {
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer >= (q.options?.length ?? 0)) {
            console.error(`CHYBA: téma ${id} otázka ${q.id} — neplatný correctAnswer`);
            errors++;
        }
    }
}

for (const tid of Object.keys(TOPIC_FILE_NAMES).map(Number)) {
    const fn = TOPIC_FILE_NAMES[tid];
    const fp = join(preDir, fn);
    if (!existsSync(fp)) {
        console.error(`CHYBA: chýba súbor pre predgenerované učenie: ${fn}`);
        errors++;
        continue;
    }
    const doc = JSON.parse(readFileSync(fp, 'utf8'));
    if (doc.topicId !== tid) {
        console.error(`CHYBA: ${fn} má topicId ${doc.topicId}, očakávam ${tid}`);
        errors++;
    }
    if (!doc.byQuestionId || !doc.allCorrectSections?.length) {
        console.error(`CHYBA: ${fn} — chýba byQuestionId alebo allCorrectSections`);
        errors++;
    }
}

if (errors === 0) {
    console.log('OK: všetky témy v katalógu majú vstupné otázky; predgenerované súbory sú prítomné a topicId sedí.');
} else {
    console.error(`Zhrnutie: ${errors} problém(ov).`);
    process.exit(1);
}
