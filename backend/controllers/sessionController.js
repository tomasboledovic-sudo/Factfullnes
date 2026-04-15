import { getTopicById } from '../utils/supabaseData.js';
import { insertSession, getSessionById } from '../utils/sessionRepository.js';

export async function createSession(req, res, next) {
    try {
        const { topicId } = req.body;
        if (!topicId) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'topicId je povinný' } });
        }

        const topic = await getTopicById(topicId);
        if (!topic) {
            return res.status(404).json({ success: false, error: { code: 'TOPIC_NOT_FOUND', message: 'Téma s daným ID neexistuje' } });
        }

        const newSession = await insertSession({ topicId, userId: req.userId || null });

        console.log(`Vytvorená nová session: ${newSession.id} pre tému: ${topic.title}`);
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

export async function getSession(req, res, next) {
    try {
        const { sessionId } = req.params;
        const session = await getSessionById(sessionId);
        if (!session) {
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
