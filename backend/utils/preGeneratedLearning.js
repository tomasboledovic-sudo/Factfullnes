import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRE_GEN_DIR = join(__dirname, '../data/preGeneratedLearning');

/** Súbor JSON pre každú tému s predgenerovaným obsahom (učenie + voliteľný záverečný test). */
const TOPIC_FILE_NAMES = {
    3: 'topic-3.json',
    5: 'topic-5.json',
    7: 'topic-7-mocniny.json',
    11: 'topic-11.json',
    12: 'topic-12.json',
    13: 'topic-13.json',
    14: 'topic-14.json',
    15: 'topic-15.json',
    16: 'topic-16.json',
    17: 'topic-17.json'
};

/** Témy, kde sa učebný materiál (a ak je v súbore, aj záverečný test) berie výhradne lokálne — bez Gemini. */
export const PRE_GENERATED_LEARNING_TOPIC_IDS = new Set(Object.keys(TOPIC_FILE_NAMES).map(Number));

function toTopicId(id) {
    const n = typeof id === 'number' ? id : parseInt(String(id), 10);
    return Number.isFinite(n) ? n : null;
}

function getTopicFilePath(tid) {
    const name = TOPIC_FILE_NAMES[tid];
    if (!name) return null;
    return join(PRE_GEN_DIR, name);
}

export function loadPreGeneratedTopicRaw(topicId) {
    const tid = toTopicId(topicId);
    if (tid == null) return null;
    const fp = getTopicFilePath(tid);
    if (!fp || !existsSync(fp)) return null;
    try {
        const data = JSON.parse(readFileSync(fp, 'utf8'));
        if (toTopicId(data.topicId) !== tid) return null;
        return data;
    } catch {
        return null;
    }
}

function wrapSections(rawList) {
    const sections = rawList.map((s, i) => ({
        type: 'topic',
        heading: s.heading || `Sekcia ${i + 1}`,
        content: s.content || '',
        order: i + 1
    }));
    return {
        sections,
        totalDuration: Math.max(sections.length * 2, 4),
        keyTakeaways: sections.map(s => s.heading)
    };
}

/**
 * Kompletný balík: sekcie + voliteľný finalTest z JSON.
 * Vráti null ak téma nemá súbor alebo chýba mapovanie pre chybné odpovede.
 */
export function buildPreGeneratedLearningBundle(topicData, testResults) {
    const tid = toTopicId(topicData?.id);
    if (tid == null || !PRE_GENERATED_LEARNING_TOPIC_IDS.has(tid)) return null;

    const data = loadPreGeneratedTopicRaw(tid);
    if (!data) return null;

    const byId = data.byQuestionId || {};
    const answers = testResults?.detailedAnswers || [];
    const wrong = answers.filter(a => !a.wasCorrect);

    let wrapped;
    if (wrong.length === 0) {
        const list = data.allCorrectSections;
        if (!Array.isArray(list) || list.length === 0) return null;
        wrapped = wrapSections(list);
    } else {
        const built = [];
        for (const a of wrong.slice(0, 8)) {
            const entry = byId[a.questionId];
            if (!entry || !entry.content) return null;
            built.push({ heading: entry.heading, content: entry.content });
        }
        wrapped = wrapSections(built);
    }

    const out = { ...wrapped };
    if (data.finalTest?.questions?.length > 0) {
        const orderIds = testResults?.questionIdsInOrder || [];
        const ftq = data.finalTest.questions;
        const wlist = wrong.slice(0, 8);
        let picked = [];
        if (orderIds.length > 0 && wlist.length > 0) {
            for (const wa of wlist) {
                const idx = orderIds.indexOf(wa.questionId);
                if (idx >= 0 && ftq[idx]) picked.push(ftq[idx]);
            }
        }
        if (picked.length < wlist.length && ftq.length >= wlist.length) {
            picked = ftq.slice(0, wlist.length);
        }
        out.finalTest = {
            ...data.finalTest,
            description: 'Záverečný test',
            questions: wlist.length === 0 ? [] : picked.slice(0, wlist.length)
        };
    }
    return out;
}

/**
 * Len sekcie (spätná kompatibilita).
 */
export function tryPreGeneratedLearningContent(topicData, testResults) {
    const b = buildPreGeneratedLearningBundle(topicData, testResults);
    if (!b) return null;
    const { finalTest: _f, ...rest } = b;
    return rest;
}

export function usesOnlyPreGeneratedLearning(topicData) {
    const tid = toTopicId(topicData?.id);
    return tid != null && PRE_GENERATED_LEARNING_TOPIC_IDS.has(tid);
}
