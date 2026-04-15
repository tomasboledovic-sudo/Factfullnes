import { getTopicById } from '../utils/supabaseData.js';
import { getSessionById, patchSession } from '../utils/sessionRepository.js';
import { sanitizeFinalTestForSession } from '../services/geminiService.js';
import { buildPreGeneratedLearningBundle, usesOnlyPreGeneratedLearning } from '../utils/preGeneratedLearning.js';

export async function getContent(req, res, next) {
    try {
        const { sessionId } = req.params;
        const session = await getSessionById(sessionId);

        if (!session) {
            return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session s daným ID neexistuje' } });
        }
        if (!session.generated_content) {
            return res.status(404).json({ success: false, error: { code: 'CONTENT_NOT_GENERATED', message: 'Učebný obsah ešte nebol vygenerovaný.' } });
        }

        const topic = await getTopicById(session.topic_id);
        let generatedContent = session.generated_content;

        // Témy s predgenerovaným obsahom: pri každom načítaní zosúladiť reláciu so súborom na disku (starý cache v DB inak ostáva navždy).
        if (topic && usesOnlyPreGeneratedLearning(topic) && session.pre_test_answers?.length) {
            const preAnswers = session.pre_test_answers;
            const correctCount = preAnswers.filter(a => a.wasCorrect).length;
            const totalCount = preAnswers.length;
            const percentage =
                session.pre_test_score != null
                    ? session.pre_test_score
                    : Math.round((correctCount / totalCount) * 100 * 10) / 10;
            const testResults = {
                score: percentage,
                totalQuestions: totalCount,
                correctAnswers: correctCount,
                detailedAnswers: preAnswers
            };
            const fresh = buildPreGeneratedLearningBundle(topic, testResults);
            if (fresh) {
                const merged = {
                    sections: fresh.sections,
                    totalDuration: fresh.totalDuration,
                    keyTakeaways: fresh.keyTakeaways,
                    ...(fresh.finalTest?.questions?.length
                        ? { finalTest: fresh.finalTest }
                        : generatedContent?.finalTest?.questions?.length
                          ? { finalTest: generatedContent.finalTest }
                          : {})
                };
                const sectionsChanged =
                    JSON.stringify(generatedContent?.sections) !== JSON.stringify(fresh.sections);
                const metaChanged =
                    generatedContent?.totalDuration !== fresh.totalDuration ||
                    JSON.stringify(generatedContent?.keyTakeaways) !== JSON.stringify(fresh.keyTakeaways);
                const finalChanged =
                    JSON.stringify(generatedContent?.finalTest) !== JSON.stringify(merged.finalTest);
                if (sectionsChanged || metaChanged || finalChanged) {
                    await patchSession(sessionId, {
                        generated_content: merged,
                        content_generated_at: new Date().toISOString()
                    });
                }
                generatedContent = merged;
            }
        }

        let finalTest = generatedContent.finalTest || null;
        if (finalTest) {
            const cleaned = sanitizeFinalTestForSession(
                finalTest,
                topic?.title || 'Neznáma téma',
                generatedContent.sections
            );
            if (JSON.stringify(finalTest) !== JSON.stringify(cleaned)) {
                finalTest = cleaned;
                const updatedContent = { ...generatedContent, finalTest: cleaned };
                await patchSession(sessionId, { generated_content: updatedContent });
                generatedContent = updatedContent;
            }
        }

        const preAns = session.pre_test_answers || [];
        const preCorrect = preAns.filter((a) => a.wasCorrect).length;
        const preTotal = preAns.length;
        const weaknessCount = preAns.filter((a) => !a.wasCorrect).length;

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.json({
            success: true,
            data: {
                sessionId,
                topicId: session.topic_id,
                topicTitle: topic?.title || 'Neznáma téma',
                preTestScore: session.pre_test_score || 0,
                preTestDetail: {
                    correct: preCorrect,
                    total: preTotal,
                    label: `${preCorrect}/${preTotal}`,
                    weaknessQuestionCount: weaknessCount
                },
                totalEstimatedMinutes: generatedContent.totalDuration,
                sections: generatedContent.sections,
                finalTest,
                generatedAt: session.content_generated_at
            }
        });
    } catch (error) {
        next(error);
    }
}
