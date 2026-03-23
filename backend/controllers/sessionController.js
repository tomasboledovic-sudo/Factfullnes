import { readData } from '../utils/paths.js';
import supabase from '../services/supabaseClient.js';

/**
 * POST /api/sessions
 */
export async function createSession(req, res, next) {
    try {
        const { topicId } = req.body;

        if (!topicId) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'topicId je povinný', details: { field: 'topicId' } }
            });
        }

        const topics = readData('topics.json');
        const topic = topics.find(t => t.id === topicId);

        if (!topic) {
            return res.status(404).json({
                success: false,
                error: { code: 'TOPIC_NOT_FOUND', message: 'Téma s daným ID neexistuje' }
            });
        }

        const { data: newSession, error } = await supabase
            .from('sessions')
            .insert({
                topic_id: topicId,
                user_id: req.userId || null,
                status: 'pre_assessment'
            })
            .select('id, topic_id, status, created_at')
            .single();

        if (error) throw error;

        console.log(`✅ Vytvorená nová session: ${newSession.id} pre tému: ${topic.title}`);

        res.status(201).json({
            success: true,
            data: {
                sessionId: newSession.id,
                topicId: newSession.topic_id,
                status: newSession.status,
                createdAt: newSession.created_at
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/sessions/:sessionId
 */
export async function getSession(req, res, next) {
    try {
        const { sessionId } = req.params;

        const { data: session, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .maybeSingle();

        if (error || !session) {
            return res.status(404).json({
                success: false,
                error: { code: 'SESSION_NOT_FOUND', message: 'Session s daným ID neexistuje' }
            });
        }

        res.json({ success: true, data: session });
    } catch (error) {
        next(error);
    }
}
