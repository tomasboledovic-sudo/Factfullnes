import { getTopicById, getQuestionsByTopicId } from '../utils/supabaseData.js';
import { generateLearningContent, generateFinalTest, sanitizeFinalTestForSession } from '../services/geminiService.js';
import { getSessionById, patchSession } from '../utils/sessionRepository.js';

async function fetchSession(sessionId) {
    return getSessionById(sessionId);
}

async function updateSession(sessionId, fields) {
    await patchSession(sessionId, fields);
}

/**
 * POST /api/sessions/:sessionId/pre-test/submit
 * Evaluates answers and synchronously generates learning content.
 */
export async function submitPreTest(req, res, next) {
    try {
        const { sessionId } = req.params;
        const { answers } = req.body;

        console.log(`📝 Spracovávam vstupný test pre session: ${sessionId}`);

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Odpovede musia byť neprázdne pole' }
            });
        }

        const session = await fetchSession(sessionId);
        if (!session) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });
        if (session.status !== 'pre_assessment') return res.status(409).json({ success: false, error: { code: 'INVALID_SESSION_STATUS', message: 'Session nie je v správnom stave' } });

        const questions = await getQuestionsByTopicId(session.topic_id);
        if (!questions?.length) throw new Error('Otázky pre túto tému neboli nájdené');

        const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a]));
        const evaluatedAnswers = questions.map((question) => {
            const answer = answerByQuestionId.get(question.id);
            if (!answer) throw new Error(`Chýba odpoveď na otázku ${question.id}`);
            return {
                questionId: question.id,
                questionText: question.questionText,
                userSelectedOption: question.options[answer.selectedOptionIndex],
                correctOption: question.options[question.correctAnswer],
                selectedOptionIndex: answer.selectedOptionIndex,
                correctAnswerIndex: question.correctAnswer,
                wasCorrect: answer.selectedOptionIndex === question.correctAnswer,
                answeredAt: answer.answeredAt
            };
        });

        const correctCount = evaluatedAnswers.filter(a => a.wasCorrect).length;
        const totalCount = evaluatedAnswers.length;
        const percentage = Math.round((correctCount / totalCount) * 100 * 10) / 10;

        console.log(`✅ Skóre: ${percentage}% (${correctCount}/${totalCount})`);

        await updateSession(sessionId, {
            pre_test_answers: evaluatedAnswers,
            pre_test_score: percentage,
            status: 'generating_content'
        });

        // Generate learning content synchronously — background tasks don't work on Vercel
        const topic = await getTopicById(session.topic_id);
        const testResults = {
            score: percentage,
            totalQuestions: totalCount,
            correctAnswers: correctCount,
            detailedAnswers: evaluatedAnswers,
            questionIdsInOrder: questions.map((q) => q.id)
        };
        const generatedContent = await generateLearningContent(topic, testResults);

        await updateSession(sessionId, {
            generated_content: generatedContent,
            status: 'content_ready',
            content_generated_at: new Date().toISOString()
        });

        console.log(`✅ Učebné materiály vygenerované pre session: ${sessionId}`);

        res.json({
            success: true,
            data: {
                sessionId,
                preTestScore: { percentage, correctAnswers: correctCount, totalQuestions: totalCount, incorrectAnswers: totalCount - correctCount },
                detailedResults: evaluatedAnswers,
                contentStatus: 'ready',
                message: 'Test vyhodnotený a učebné materiály sú pripravené.'
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/sessions/:sessionId/generate-test
 * Generates the final test synchronously.
 */
export async function startTestGeneration(req, res, next) {
    try {
        const { sessionId } = req.params;
        console.log(`🎯 Generujem záverečný test pre session: ${sessionId}`);

        const session = await fetchSession(sessionId);
        if (!session) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });

        if (session.generated_content?.finalTest?.questions?.length > 0) {
            return res.json({ success: true, data: { status: 'ready', message: 'Test už existuje' } });
        }

        if (!session.generated_content?.sections) {
            return res.status(400).json({ success: false, error: { code: 'NO_CONTENT', message: 'Učebné materiály ešte nie sú vygenerované' } });
        }

        const topic = await getTopicById(session.topic_id);
        const preAnswers = session.pre_test_answers || [];
        const originalTestResults = {
            score: session.pre_test_score,
            totalQuestions: preAnswers.length,
            correctAnswers: preAnswers.filter(a => a.wasCorrect).length,
            detailedAnswers: preAnswers
        };

        const finalTest = await generateFinalTest(topic, session.generated_content, originalTestResults);

        const updatedContent = { ...session.generated_content, finalTest };
        await updateSession(sessionId, {
            generated_content: updatedContent,
            status: 'learning',
            test_generated_at: new Date().toISOString()
        });

        console.log(`✅ Záverečný test vygenerovaný pre session: ${sessionId} (${finalTest.questions.length} otázok)`);
        res.json({ success: true, data: { status: 'ready', questionCount: finalTest.questions.length } });

    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/sessions/:sessionId/content/status
 */
export async function getContentStatus(req, res, next) {
    try {
        const { sessionId } = req.params;
        const session = await fetchSession(sessionId);
        if (!session) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });

        const ready = !!(session.generated_content?.sections?.length > 0);
        const status = ready ? 'ready' : (session.status === 'generation_failed' ? 'error' : 'generating');

        res.json({ success: true, data: { sessionId, status, ready, sessionStatus: session.status } });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/sessions/:sessionId/test/status
 */
export async function getTestStatus(req, res, next) {
    try {
        const { sessionId } = req.params;
        const session = await fetchSession(sessionId);
        if (!session) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });

        const ft = session.generated_content?.finalTest;
        const ready = ft != null;
        const questionCount = ft?.questions?.length ?? 0;
        res.json({
            success: true,
            data: {
                sessionId,
                status: ready ? 'ready' : 'generating',
                ready,
                questionCount
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/sessions/:sessionId/pre-test
 */
export async function getPreTest(req, res, next) {
    try {
        const { sessionId } = req.params;
        const session = await fetchSession(sessionId);
        if (!session) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });

        const questions = await getQuestionsByTopicId(session.topic_id);
        if (!questions?.length) return res.status(404).json({ success: false, error: { code: 'QUESTIONS_NOT_FOUND', message: 'Otázky neboli nájdené' } });

        const topic = await getTopicById(session.topic_id);

        res.json({
            success: true,
            data: {
                sessionId,
                topicId: session.topic_id,
                topicTitle: topic?.title || 'Neznáma téma',
                totalQuestions: questions.length,
                questions: questions.map(q => ({
                    id: q.id,
                    questionNumber: q.order,
                    questionText: q.questionText,
                    questionType: q.questionType,
                    options: q.options
                }))
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/sessions/:sessionId/regenerate-content
 * Znovu vygeneruje učebné materiály z AI podľa uloženého vstupného testu.
 * Záverečný test sa zmaže, aby sa dal znova vytvoriť z nového textu.
 */
export async function regenerateLearning(req, res, next) {
    try {
        const { sessionId } = req.params;
        const session = await fetchSession(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });
        }

        const preAnswers = session.pre_test_answers;
        if (!preAnswers?.length) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_PRE_TEST', message: 'Chýbajú odpovede vstupného testu — materiály nie je z čoho znova zostaviť.' }
            });
        }

        const topic = await getTopicById(session.topic_id);
        if (!topic) {
            return res.status(404).json({ success: false, error: { code: 'TOPIC_NOT_FOUND', message: 'Téma neexistuje' } });
        }

        const topicQuestions = await getQuestionsByTopicId(session.topic_id);
        const orderMap = new Map((topicQuestions || []).map((q, i) => [q.id, i]));
        const preAnswersSorted = [...preAnswers].sort(
            (a, b) => (orderMap.get(a.questionId) ?? 0) - (orderMap.get(b.questionId) ?? 0)
        );

        const correctCount = preAnswersSorted.filter((a) => a.wasCorrect).length;
        const totalCount = preAnswersSorted.length;
        const percentage =
            session.pre_test_score != null
                ? session.pre_test_score
                : Math.round((correctCount / totalCount) * 100 * 10) / 10;

        const testResults = {
            score: percentage,
            totalQuestions: totalCount,
            correctAnswers: correctCount,
            detailedAnswers: preAnswersSorted,
            questionIdsInOrder: (topicQuestions || []).map((q) => q.id)
        };

        console.log(`Obnovujem učebné materiály (AI) pre session: ${sessionId}`);
        const generatedContent = await generateLearningContent(topic, testResults);

        await updateSession(sessionId, {
            generated_content: generatedContent,
            status: 'content_ready',
            content_generated_at: new Date().toISOString(),
            test_generated_at: null
        });

        console.log(`Učebné materiály znova vygenerované pre session: ${sessionId}`);

        res.json({
            success: true,
            data: {
                sessionId,
                sectionCount: generatedContent.sections.length,
                message: 'Materiály boli znova vygenerované. Záverečný test sa pripraví znova po načítaní stránky.'
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/sessions/:sessionId/post-test/submit
 */
export async function submitPostTest(req, res, next) {
    try {
        const { sessionId } = req.params;
        const { answers, timeSpentSeconds } = req.body;

        console.log(`📝 Spracovávam záverečný test pre session: ${sessionId}`);

        if (!Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'answers musí byť pole' }
            });
        }

        const session = await fetchSession(sessionId);
        if (!session) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });

        const topicForTest = await getTopicById(session.topic_id);
        const finalTestRaw = session.generated_content?.finalTest;
        let finalTest = finalTestRaw;
        if (finalTestRaw?.questions?.length) {
            finalTest = sanitizeFinalTestForSession(
                finalTestRaw,
                topicForTest?.title || 'Téma',
                session.generated_content?.sections
            );
            if (JSON.stringify(finalTestRaw) !== JSON.stringify(finalTest)) {
                await updateSession(sessionId, {
                    generated_content: { ...session.generated_content, finalTest }
                });
            }
        }
        const preAnswers = session.pre_test_answers || [];
        const preTotal = preAnswers.length;
        const preCorrect = preAnswers.filter((a) => a.wasCorrect).length;
        const prePct = preTotal ? Math.round((preCorrect / preTotal) * 100 * 10) / 10 : 0;

        /** Žiadny záverečný test (všetko správne na vstupe) — celkové skóre = vstupné. */
        if (!finalTest?.questions?.length) {
            if (answers.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_INPUT', message: 'Záverečný test nie je vygenerovaný — neodosielaj odpovede.' }
                });
            }
            await updateSession(sessionId, {
                post_test_answers: [],
                post_test_score: prePct,
                status: 'completed',
                completed: true,
                post_test_completed_at: new Date().toISOString(),
                post_test_time_seconds: timeSpentSeconds
            });
            return res.json({
                success: true,
                data: {
                    sessionId,
                    preTestScore: session.pre_test_score ?? prePct,
                    weaknessRoundScore: null,
                    postTestScore: {
                        percentage: prePct,
                        correctAnswers: preCorrect,
                        totalQuestions: preTotal,
                        incorrectAnswers: preTotal - preCorrect
                    },
                    combinedScore: {
                        correct: preCorrect,
                        total: preTotal,
                        percentage: prePct
                    },
                    improvementPoints: 0,
                    improvementPercentPoints: 0,
                    detailedResults: [],
                    status: 'completed',
                    message: 'Vstupný test bez chýb — záverečný test sa nevyžaduje.'
                }
            });
        }

        if (answers.length !== finalTest.questions.length) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: `Očakávaný počet odpovedí: ${finalTest.questions.length}, odoslané: ${answers.length}`
                }
            });
        }

        const evaluatedAnswers = answers.map((answer, index) => {
            const question = finalTest.questions[index];
            if (!question) return { questionId: index, wasCorrect: false, error: 'Otázka nenájdená' };
            const userSelectedText = question.options[answer.selectedOptionIndex];
            return {
                questionId: answer.questionId ?? index,
                questionText: question.question,
                userSelectedOption: userSelectedText,
                correctOption: question.correctOption,
                selectedOptionIndex: answer.selectedOptionIndex,
                wasCorrect: userSelectedText === question.correctOption
            };
        });

        const finalCorrect = evaluatedAnswers.filter((a) => a.wasCorrect).length;
        const finalTotal = evaluatedAnswers.length;
        const weaknessPct = finalTotal
            ? Math.round((finalCorrect / finalTotal) * 100 * 10) / 10
            : 0;

        const combinedCorrect = preCorrect + finalCorrect;
        const combinedTotal = preTotal;
        const combinedPercentage =
            combinedTotal > 0
                ? Math.round((combinedCorrect / combinedTotal) * 100 * 10) / 10
                : 0;
        const improvementPoints = finalCorrect;
        const improvementPercentPoints = Math.round((combinedPercentage - prePct) * 10) / 10;

        console.log(
            `✅ Záverečný kolo slabých miest: ${finalCorrect}/${finalTotal} (${weaknessPct}%) | Celkom: ${combinedCorrect}/${combinedTotal} (${combinedPercentage}%) | +${improvementPoints} bodov oproti vstupu`
        );

        await updateSession(sessionId, {
            post_test_answers: evaluatedAnswers,
            post_test_score: combinedPercentage,
            status: 'completed',
            completed: true,
            post_test_completed_at: new Date().toISOString(),
            post_test_time_seconds: timeSpentSeconds
        });

        res.json({
            success: true,
            data: {
                sessionId,
                preTestScore: session.pre_test_score ?? prePct,
                weaknessRoundScore: {
                    percentage: weaknessPct,
                    correctAnswers: finalCorrect,
                    totalQuestions: finalTotal,
                    incorrectAnswers: finalTotal - finalCorrect
                },
                postTestScore: {
                    percentage: combinedPercentage,
                    correctAnswers: combinedCorrect,
                    totalQuestions: combinedTotal,
                    incorrectAnswers: combinedTotal - combinedCorrect
                },
                combinedScore: {
                    correct: combinedCorrect,
                    total: combinedTotal,
                    percentage: combinedPercentage
                },
                improvementPoints,
                improvementPercentPoints,
                detailedResults: evaluatedAnswers,
                improvement: improvementPercentPoints,
                status: 'completed',
                message: 'Test vyhodnotený'
            }
        });

    } catch (error) {
        next(error);
    }
}
