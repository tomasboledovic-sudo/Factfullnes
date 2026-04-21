import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import supabase from '../services/supabaseClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const topicsPath = join(__dirname, '../data/topics.json');
const preTestPath = join(__dirname, '../data/preTestQuestions.json');

let cachedLocalTopics = null;
let cachedLocalPreTest = null;

function loadLocalTopics() {
    if (!cachedLocalTopics) {
        cachedLocalTopics = JSON.parse(readFileSync(topicsPath, 'utf8'));
    }
    return cachedLocalTopics;
}

function loadLocalPreTest() {
    if (!cachedLocalPreTest) {
        cachedLocalPreTest = JSON.parse(readFileSync(preTestPath, 'utf8'));
    }
    return cachedLocalPreTest;
}

function useLocalTopicData() {
    return (
        process.env.USE_LOCAL_TOPIC_DATA === '1' ||
        String(process.env.USE_LOCAL_TOPIC_DATA || '').toLowerCase() === 'true'
    );
}

function mapRowToTopic(t) {
    return {
        id: t.id,
        title: t.title,
        category: t.category,
        difficulty: t.difficulty,
        description: t.description,
        longDescription: t.long_description ?? t.longDescription,
        estimatedDuration: t.estimated_duration ?? t.estimatedDuration,
        coverImage: t.cover_image ?? t.coverImage
    };
}

/** PostgREST: tabuľka nie je v schéme (napr. ešte nebola spustená migrácia). */
function isMissingTable(error, tableName) {
    if (!error) return false;
    const msg = String(error.message || '');
    if (error.code === 'PGRST205' && msg.includes(tableName)) return true;
    return msg.includes('Could not find the table') && msg.includes(tableName);
}

export async function getTopics() {
    if (useLocalTopicData()) {
        console.warn('[topics] USE_LOCAL_TOPIC_DATA — data/topics.json');
        return loadLocalTopics().map(mapRowToTopic);
    }
    const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('id', { ascending: true })
        .limit(500);
    if (!error && Array.isArray(data)) {
        return data.map(mapRowToTopic);
    }
    if (isMissingTable(error, 'topics')) {
        console.warn('[topics] Tabuľka topics v Supabase chýba — používam data/topics.json');
        return loadLocalTopics().map(mapRowToTopic);
    }
    throw error;
}

export async function getTopicById(topicId) {
    const id = typeof topicId === 'number' ? topicId : parseInt(topicId, 10);
    if (useLocalTopicData()) {
        const t = loadLocalTopics().find((x) => x.id === id);
        return t ? mapRowToTopic(t) : null;
    }
    const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (!error && data) {
        return mapRowToTopic(data);
    }
    if (!error && !data) return null;
    if (isMissingTable(error, 'topics')) {
        const t = loadLocalTopics().find(x => x.id === id);
        return t ? mapRowToTopic(t) : null;
    }
    throw error;
}

export async function getQuestionsByTopicId(topicId) {
    if (useLocalTopicData()) {
        const list = loadLocalPreTest()[String(topicId)] || [];
        return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    const { data, error } = await supabase
        .from('pre_test_questions')
        .select('*')
        .eq('topic_id', topicId)
        .order('order');
    if (!error && Array.isArray(data)) {
        const mapped = data.map((q) => ({
            id: q.id,
            topicId: q.topic_id,
            questionText: q.question_text,
            questionType: q.question_type,
            options: q.options,
            correctAnswer: q.correct_answer,
            order: q.order
        }));
        if (mapped.length > 0) return mapped;
        console.warn(
            `[topics] pre_test_questions: pre topic_id=${topicId} žiadne riadky v DB — používam data/preTestQuestions.json`
        );
        const fallback = loadLocalPreTest()[String(topicId)] || [];
        return [...fallback].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    if (isMissingTable(error, 'pre_test_questions')) {
        console.warn('[topics] Tabuľka pre_test_questions v Supabase chýba — používam data/preTestQuestions.json');
        const list = loadLocalPreTest()[String(topicId)] || [];
        return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    throw error;
}
