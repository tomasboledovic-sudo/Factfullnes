import { readData } from '../utils/paths.js';
import { generateLearningContent, generateFinalTest } from '../services/geminiService.js';
import supabase from '../services/supabaseClient.js';

const generationStatus = new Map();

// Helper: načítaj session zo Supabase
async function fetchSession(sessionId) {
    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

// Helper: aktualizuj session
async function updateSession(sessionId, fields) {
    const { error } = await supabase
        .from('sessions')
        .update(fields)
        .eq('id', sessionId);
    if (error) throw error;
}

/**
 * POST /api/sessions/:sessionId/pre-test/submit
 */
export async function submitPreTest(req, res, next) {
    try {
        const { sessionId } = req.params;
        const { answers, timeSpentSeconds } = req.body;

        console.log(`📝 Spracovávam vstupný test pre session: ${sessionId}`);

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Odpovede musia byť neprázdne pole' }
            });
        }

        const session = await fetchSession(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });
        }
        if (session.status !== 'pre_assessment') {
            return res.status(409).json({ success: false, error: { code: 'INVALID_SESSION_STATUS', message: 'Session nie je v správnom stave' } });
        }

        const allQuestions = readData('preTestQuestions.json');
        const questions = allQuestions[session.topic_id.toString()];
        if (!questions) throw new Error('Otázky pre túto tému neboli nájdené');

        const evaluatedAnswers = answers.map(answer => {
            const question = questions.find(q => q.id === answer.questionId);
            if (!question) throw new Error(`Otázka ${answer.questionId} neexistuje`);
            return {
                questionId: answer.questionId,
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

        generationStatus.set(sessionId, { status: 'generating_content', startedAt: Date.now() });

        res.json({
            success: true,
            data: {
                sessionId,
                preTestScore: { percentage, correctAnswers: correctCount, totalQuestions: totalCount, incorrectAnswers: totalCount - correctCount },
                detailedResults: evaluatedAnswers,
                contentStatus: 'generating',
                message: 'Test vyhodnotený. Učebné materiály sa generujú.'
            }
        });

        generateContentInBackground(sessionId, session.topic_id, {
            score: percentage,
            totalQuestions: totalCount,
            correctAnswers: correctCount,
            detailedAnswers: evaluatedAnswers
        });

    } catch (error) {
        next(error);
    }
}

async function generateContentInBackground(sessionId, topicId, testResults) {
    try {
        console.log(`🔄 [POZADIE] Generujem učebné materiály pre session: ${sessionId}`);
        const topics = readData('topics.json');
        const topic = topics.find(t => t.id === topicId);
        if (!topic) throw new Error('Téma nebola nájdená');

        const generatedContent = await generateLearningContent(topic, testResults);

        await updateSession(sessionId, {
            generated_content: generatedContent,
            status: 'content_ready',
            content_generated_at: new Date().toISOString()
        });

        generationStatus.set(sessionId, { status: 'content_ready', completedAt: Date.now() });
        console.log(`✅ [POZADIE] Učebné materiály hotové pre session: ${sessionId}`);

    } catch (error) {
        console.error(`❌ [POZADIE] Chyba:`, error.message);
        generationStatus.set(sessionId, { status: 'error', error: error.message });
        try { await updateSession(sessionId, { status: 'generation_failed' }); } catch (e) {}
    }
}

/**
 * POST /api/sessions/:sessionId/generate-test
 */
export async function startTestGeneration(req, res, next) {
    try {
        const { sessionId } = req.params;
        console.log(`🎯 Spúšťam generovanie záverečného testu pre session: ${sessionId}`);

        const session = await fetchSession(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });
        }

        if (session.generated_content?.finalTest?.questions?.length > 0) {
            return res.json({ success: true, data: { status: 'ready', message: 'Test už existuje' } });
        }

        if (!session.generated_content?.sections) {
            return res.status(400).json({ success: false, error: { code: 'NO_CONTENT', message: 'Učebné materiály ešte nie sú vygenerované' } });
        }

        await updateSession(sessionId, {
            status: session.status === 'content_ready' ? 'learning' : session.status,
            test_generation_started_at: new Date().toISOString()
        });

        generationStatus.set(`${sessionId}_test`, { status: 'generating', startedAt: Date.now() });

        res.json({ success: true, data: { status: 'generating', message: 'Záverečný test sa generuje na pozadí' } });

        generateTestInBackground(sessionId);

    } catch (error) {
        next(error);
    }
}

async function generateTestInBackground(sessionId) {
    try {
        console.log(`🔄 [POZADIE] Generujem záverečný test pre session: ${sessionId}`);

        const session = await fetchSession(sessionId);
        if (!session?.generated_content) throw new Error('Session alebo učebný obsah neexistuje');

        const topics = readData('topics.json');
        const topic = topics.find(t => t.id === session.topic_id);
        if (!topic) throw new Error('Téma nebola nájdená');

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
            test_generated_at: new Date().toISOString()
        });

        generationStatus.set(`${sessionId}_test`, { status: 'ready', completedAt: Date.now() });
        console.log(`✅ [POZADIE] Záverečný test hotový pre session: ${sessionId}`);

    } catch (error) {
        console.error(`❌ [POZADIE] Chyba pri generovaní testu:`, error.message);
        generationStatus.set(`${sessionId}_test`, { status: 'error', error: error.message });
    }
}

/**
 * GET /api/sessions/:sessionId/content/status
 */
export async function getContentStatus(req, res, next) {
    try {
        const { sessionId } = req.params;
        const session = await fetchSession(sessionId);

        if (!session) {
            return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });
        }

        let status = 'unknown', ready = false;
        if (session.generated_content && session.status !== 'generating_content') {
            status = 'ready'; ready = true;
        } else if (session.status === 'generating_content') {
            status = 'generating';
        } else if (session.status === 'generation_failed') {
            status = 'error';
        }

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

        if (!session) {
            return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });
        }

        const hasTest = session.generated_content?.finalTest?.questions?.length > 0;
        res.json({
            success: true,
            data: {
                sessionId,
                status: hasTest ? 'ready' : 'generating',
                ready: hasTest,
                questionCount: hasTest ? session.generated_content.finalTest.questions.length : 0
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

        if (!session) {
            return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });
        }

        const allQuestions = readData('preTestQuestions.json');
        const questions = allQuestions[session.topic_id.toString()];

        if (!questions) {
            return res.status(404).json({ success: false, error: { code: 'QUESTIONS_NOT_FOUND', message: 'Otázky neboli nájdené' } });
        }

        const topics = readData('topics.json');
        const topic = topics.find(t => t.id === session.topic_id);

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
 * POST /api/sessions/:sessionId/post-test/submit
 */
export async function submitPostTest(req, res, next) {
    try {
        const { sessionId } = req.params;
        const { answers, timeSpentSeconds } = req.body;

        console.log(`📝 Spracovávam záverečný test pre session: ${sessionId}`);

        const session = await fetchSession(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session neexistuje' } });
        }

        const finalTest = session.generated_content?.finalTest;
        if (!finalTest?.questions) {
            return res.status(400).json({ success: false, error: { code: 'NO_FINAL_TEST', message: 'Záverečný test neexistuje' } });
        }

        const evaluatedAnswers = answers.map((answer, index) => {
            const question = finalTest.questions[index];
            if (!question) return { questionId: index, wasCorrect: false, error: 'Otázka nenájdená' };
            const userSelectedText = question.options[answer.selectedOptionIndex];
            return {
                questionId: answer.questionId || index,
                questionText: question.question,
                userSelectedOption: userSelectedText,
                correctOption: question.correctOption,
                selectedOptionIndex: answer.selectedOptionIndex,
                wasCorrect: userSelectedText === question.correctOption
            };
        });

        const correctCount = evaluatedAnswers.filter(a => a.wasCorrect).length;
        const totalCount = evaluatedAnswers.length;
        const percentage = Math.round((correctCount / totalCount) * 100 * 10) / 10;
        const improvement = percentage - (session.pre_test_score || 0);

        console.log(`✅ Záverečné skóre: ${percentage}% | Zlepšenie: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);

        await updateSession(sessionId, {
            post_test_answers: evaluatedAnswers,
            post_test_score: percentage,
            status: 'completed',
            completed: true,
            post_test_completed_at: new Date().toISOString(),
            post_test_time_seconds: timeSpentSeconds
        });

        res.json({
            success: true,
            data: {
                sessionId,
                postTestScore: { percentage, correctAnswers: correctCount, totalQuestions: totalCount, incorrectAnswers: totalCount - correctCount },
                detailedResults: evaluatedAnswers,
                preTestScore: session.pre_test_score || 0,
                improvement,
                status: 'completed',
                message: 'Test vyhodnotený'
            }
        });

    } catch (error) {
        next(error);
    }
}
