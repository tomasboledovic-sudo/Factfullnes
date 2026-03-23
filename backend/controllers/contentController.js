import { readData } from '../utils/paths.js';
import supabase from '../services/supabaseClient.js';

/**
 * GET /api/sessions/:sessionId/content
 */
export async function getContent(req, res, next) {
    try {
        const { sessionId } = req.params;

        const { data: session, error } = await supabase
            .from('sessions')
            .select('id, topic_id, pre_test_score, generated_content, content_generated_at')
            .eq('id', sessionId)
            .maybeSingle();

        if (error || !session) {
            return res.status(404).json({
                success: false,
                error: { code: 'SESSION_NOT_FOUND', message: 'Session s daným ID neexistuje' }
            });
        }

        if (!session.generated_content) {
            return res.status(404).json({
                success: false,
                error: { code: 'CONTENT_NOT_GENERATED', message: 'Učebný obsah ešte nebol vygenerovaný. Dokončite najprv vstupný test.' }
            });
        }

        const topics = readData('topics.json');
        const topic = topics.find(t => t.id === session.topic_id);

        res.json({
            success: true,
            data: {
                sessionId,
                topicId: session.topic_id,
                topicTitle: topic?.title || 'Neznáma téma',
                preTestScore: session.pre_test_score || 0,
                totalEstimatedMinutes: session.generated_content.totalDuration,
                sections: session.generated_content.sections,
                finalTest: session.generated_content.finalTest || null,
                generatedAt: session.content_generated_at
            }
        });

    } catch (error) {
        next(error);
    }
}
