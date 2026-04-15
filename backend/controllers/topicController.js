import { getTopicById as fetchTopic, getTopics as fetchTopics } from '../utils/supabaseData.js';

export async function getAllTopics(req, res, next) {
    try {
        const topics = await fetchTopics();
        res.json({ success: true, data: topics });
    } catch (error) {
        next(error);
    }
}

export async function getTopicById(req, res, next) {
    try {
        const { topicId } = req.params;
        const data = await fetchTopic(topicId);
        if (!data) {
            return res.status(404).json({
                success: false,
                error: { code: 'TOPIC_NOT_FOUND', message: 'Téma s daným ID neexistuje' }
            });
        }
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
}
