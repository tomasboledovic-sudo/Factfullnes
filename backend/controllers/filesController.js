import { createRequire } from 'module';
import supabase from '../services/supabaseClient.js';
import {
    generateFollowUpFileQuizFromMistakes,
    generateLearningContentFromFileDocument,
    generateQuizFromFileContent,
    summarizeUploadedDocument
} from '../services/geminiService.js';

const BUCKET = 'files';
const requireFromHere = createRequire(import.meta.url);
/** pdf-parse 1.x: cez require (nie import()), aby sa v ESM nespustil testovací blok v index.js (!module.parent). */
let pdfParseFn;
function getPdfParse() {
    if (!pdfParseFn) pdfParseFn = requireFromHere('pdf-parse');
    return pdfParseFn;
}

/**
 * Stiahne súbor zo storage a vráti extrahovaný text (PDF/text) alebo prázdno pri obrázku.
 */
async function extractDocumentText(file) {
    const { data: fileBlob, error: dlErr } = await supabase.storage.from(BUCKET).download(file.file_path);
    if (dlErr) throw dlErr;

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const lower = file.file_name.toLowerCase();

    if (lower.endsWith('.pdf') || file.file_type === 'application/pdf') {
        /**
         * pdf-parse 1.x — starší pdf.js v bundli, bez pdfjs-dist 5 / DOMMatrix z prehliadača.
         */
        try {
            const result = await getPdfParse()(buffer);
            return { text: (result.text || '').trim(), isImage: false };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('pdf-parse:', msg);
            const err = new Error(
                `Nepodarilo sa extrahovať text z PDF (poškodený súbor, šifrovaný PDF alebo neštandardný formát). ${msg}`
            );
            err.status = 422;
            err.code = 'PDF_PARSE';
            throw err;
        }
    }

    if (file.file_type?.startsWith('image/')) {
        return { text: '', isImage: true };
    }

    return { text: buffer.toString('utf8').trim(), isImage: false };
}

function mapStoredQuestionsToClient(questions) {
    return (questions || []).map((q, i) => ({
        id: String(i),
        questionNumber: i + 1,
        questionText: q.question,
        options: q.options
    }));
}

function buildDetailedGrading(questions, byQuestionId) {
    return questions.map((q, i) => {
        const ans = byQuestionId.get(String(i));
        const options = q.options || [];
        const correctOption = q.correctOption;
        const correctIndex = options.findIndex((o) => String(o).trim() === String(correctOption).trim());
        const sel = ans.selectedOptionIndex;
        const wasCorrect = correctIndex >= 0 && sel === correctIndex;
        return {
            questionId: String(i),
            questionText: q.question,
            userSelectedOption: options[sel] ?? null,
            correctOption: options[correctIndex] ?? correctOption,
            selectedOptionIndex: sel,
            correctAnswerIndex: correctIndex,
            wasCorrect,
            answeredAt: ans.answeredAt || new Date().toISOString()
        };
    });
}

async function getOwnedFileOr404(req, res) {
    const { id } = req.params;
    const { data: row, error: fetchErr } = await supabase.from('file_metadata').select('*').eq('id', id).maybeSingle();
    if (fetchErr || !row) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Súbor neexistuje' } });
        return null;
    }
    if (String(row.user_id) !== String(req.userId)) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Súbor neexistuje' } });
        return null;
    }
    return row;
}

/**
 * Zjednotená, stručná správa pre klienta pri chybe uploadu / DB.
 */
function wrapFileUploadError(error) {
    const msg = String(error?.message ?? '');
    const lower = msg.toLowerCase();
    if (lower.includes('bucket') && lower.includes('not found')) {
        return new Error('Bucket „files“ v Supabase Storage neexistuje alebo je nesprávny názov.');
    }
    if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('permission denied')) {
        return new Error('Chyba oprávnení v databáze (RLS). Skontroluj politiky pre tabuľku file_metadata.');
    }
    if (lower.includes('jwt') || lower.includes('invalid api key')) {
        return new Error('Neplatný Supabase kľúč v konfigurácii servera.');
    }
    if (
        lower.includes('file_metadata_user_id_fkey') ||
        (lower.includes('foreign key') && lower.includes('file_metadata') && lower.includes('user_id'))
    ) {
        return new Error(
            'V databáze je na file_metadata.user_id nastavený odkaz na auth.users; aplikácia používa tabuľku public.users. Spusti v Supabase SQL Editor súbor backend/sql/fix-file-metadata-user-fk.sql'
        );
    }
    if (msg.length > 300) {
        return new Error('Nepodarilo sa nahrať súbor. Skontroluj Supabase (URL, kľúč, bucket „files“, tabuľka file_metadata).');
    }
    return error;
}

/**
 * Metadáta nahraných súborov používateľa (pre profil alebo API).
 */
export async function listFilesMetadataForUser(userId) {
    const { data, error } = await supabase
        .from('file_metadata')
        .select('id, file_name, file_size, file_type, uploaded_at')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

/**
 * GET /api/files — len súbory prihláseného používateľa (req.userId z JWT)
 */
export async function listFiles(req, res, next) {
    try {
        const rows = await listFilesMetadataForUser(req.userId);
        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/files  (multipart/form-data with field "file")
 */
export async function uploadFile(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'Žiadny súbor nebol nahraný' } });
        }

        const ext = req.file.originalname.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = `uploads/${req.userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false
            });
        if (uploadError) throw uploadError;

        const { data: inserted, error: dbError } = await supabase
            .from('file_metadata')
            .insert({
                user_id: req.userId,
                file_name: req.file.originalname,
                file_path: filePath,
                file_size: req.file.size,
                file_type: req.file.mimetype,
                uploaded_at: new Date().toISOString()
            })
            .select('*')
            .single();
        if (dbError) throw dbError;

        console.log(`✅ Súbor nahraný: ${req.file.originalname}`);
        res.status(201).json({ success: true, data: inserted });
    } catch (error) {
        console.error('uploadFile:', error);
        next(wrapFileUploadError(error));
    }
}

/**
 * DELETE /api/files/:id
 */
export async function deleteFile(req, res, next) {
    try {
        const { id } = req.params;

        const { data: file, error: fetchErr } = await supabase
            .from('file_metadata')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr || !file) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Súbor neexistuje' } });
        }
        if (String(file.user_id) !== String(req.userId)) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Súbor neexistuje' } });
        }

        await supabase.storage.from(BUCKET).remove([file.file_path]);
        await supabase.from('file_metadata').delete().eq('id', id);

        console.log(`🗑️ Súbor zmazaný: ${file.file_name}`);
        res.json({ success: true, message: 'Súbor bol zmazaný' });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/files/:id/summarize
 */
export async function summarizeFile(req, res, next) {
    try {
        const { id } = req.params;

        const { data: file, error: fetchErr } = await supabase
            .from('file_metadata')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr || !file) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Súbor neexistuje' } });
        }
        if (String(file.user_id) !== String(req.userId)) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Súbor neexistuje' } });
        }

        const { text: fileContent, isImage } = await extractDocumentText(file);

        if (isImage) {
            return res.status(422).json({
                success: false,
                error: { code: 'EMPTY_CONTENT', message: 'Pre obrázky zatiaľ nie je podporované textové zhrnutie' }
            });
        }

        if (!fileContent.trim()) {
            return res.status(422).json({ success: false, error: { code: 'EMPTY_CONTENT', message: 'Zo súboru sa nepodarilo extrahovať text' } });
        }

        const summary = await summarizeUploadedDocument(fileContent, file.file_name);
        res.json({ success: true, data: { summary, fileName: file.file_name } });
    } catch (error) {
        console.error('summarizeFile:', error);
        const msg = String(error?.message || '');
        if (!error.status && msg.includes('GEMINI_API_KEY')) {
            error.status = 500;
        }
        if (!error.status && (msg.includes('Gemini API') || msg.includes('fetch'))) {
            error.status = 502;
        }
        next(error);
    }
}

/**
 * POST /api/files/:id/quiz/generate
 * Telo (voliteľné): { "questionCount": 4–10 }, predvolené 6 (menej tokenov na Gemini free tier)
 */
export async function generateFileQuiz(req, res, next) {
    try {
        const file = await getOwnedFileOr404(req, res);
        if (!file) return;

        let questionCount = parseInt(req.body?.questionCount, 10);
        if (Number.isNaN(questionCount)) questionCount = 6;

        const { text, isImage } = await extractDocumentText(file);
        if (isImage) {
            return res.status(422).json({
                success: false,
                error: {
                    code: 'NO_TEXT',
                    message: 'Z obrázku nie je možné vygenerovať test — nahraj PDF alebo textový súbor.'
                }
            });
        }
        if (!text.trim()) {
            return res.status(422).json({
                success: false,
                error: { code: 'NO_TEXT', message: 'Zo súboru sa nepodarilo načítať text pre test.' }
            });
        }

        const quiz = await generateQuizFromFileContent(file.file_name, text, questionCount);
        const payload = {
            version: 1,
            createdAt: new Date().toISOString(),
            sourceFileName: file.file_name,
            testFormat: quiz.testFormat,
            description: quiz.description,
            questions: quiz.questions
        };

        const { error: upErr } = await supabase.from('file_metadata').update({ generated_quiz: payload }).eq('id', file.id);
        if (upErr) {
            const msg = String(upErr.message || '');
            if (msg.includes('generated_quiz') || upErr.code === '42703') {
                return res.status(500).json({
                    success: false,
                    error: {
                        code: 'SCHEMA',
                        message:
                            'V databáze chýba stĺpec generated_quiz. Spusti v Supabase SQL Editor súbor backend/sql/file-metadata-quiz-column.sql'
                    }
                });
            }
            throw upErr;
        }

        res.json({
            success: true,
            data: {
                questionCount: quiz.questions.length,
                description: quiz.description
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/files/:id/quiz — otázky bez správnych odpovedí
 */
export async function getFileQuiz(req, res, next) {
    try {
        const file = await getOwnedFileOr404(req, res);
        if (!file) return;

        const raw = file.generated_quiz;
        if (!raw?.questions?.length) {
            return res.status(404).json({
                success: false,
                error: { code: 'QUIZ_NOT_GENERATED', message: 'Test zatiaľ nie je vygenerovaný.' }
            });
        }

        const questions = mapStoredQuestionsToClient(raw.questions);

        const data = {
            fileId: file.id,
            fileName: file.file_name,
            description: raw.description || '',
            questionCount: questions.length,
            questions
        };
        const fu = raw.followUpQuiz;
        if (fu?.questions?.length) {
            data.followUpQuiz = {
                description: fu.description || '',
                questionCount: fu.questions.length,
                questions: mapStoredQuestionsToClient(fu.questions)
            };
        } else {
            data.followUpQuiz = null;
        }

        const fl = raw.fileLearningContent;
        if (fl?.sections?.length) {
            data.fileLearningContent = {
                generatedAt: fl.generatedAt || null,
                sections: fl.sections,
                keyTakeaways: fl.keyTakeaways || [],
                totalDuration: fl.totalDuration ?? fl.sections.length * 2
            };
        } else {
            data.fileLearningContent = null;
        }

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/files/:id/quiz/submit
 * Telo: { answers: [{ questionId, selectedOptionIndex, answeredAt? }], quizPhase?: "main" | "followUp" }
 */
export async function submitFileQuiz(req, res, next) {
    try {
        const file = await getOwnedFileOr404(req, res);
        if (!file) return;

        const raw = file.generated_quiz;
        if (!raw?.questions?.length) {
            return res.status(400).json({
                success: false,
                error: { code: 'QUIZ_NOT_GENERATED', message: 'Test neexistuje. Najprv ho vygeneruj.' }
            });
        }

        const quizPhase = req.body?.quizPhase === 'followUp' ? 'followUp' : 'main';
        const questionSource =
            quizPhase === 'followUp' ? raw.followUpQuiz?.questions : raw.questions;
        if (quizPhase === 'followUp' && (!raw.followUpQuiz?.questions?.length || !Array.isArray(questionSource))) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_FOLLOWUP',
                    message: 'Doplňujúci test nie je k dispozícii. Odídi späť a znova odošli hlavný test.'
                }
            });
        }

        const { answers } = req.body;
        if (!Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Pole answers je povinné' }
            });
        }

        const total = questionSource.length;
        const byQuestionId = new Map(answers.map((a) => [String(a.questionId), a]));

        for (let i = 0; i < total; i++) {
            const ans = byQuestionId.get(String(i));
            if (!ans || typeof ans.selectedOptionIndex !== 'number') {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INCOMPLETE',
                        message: `Odpovedz na všetky otázky (chyba pri otázke ${i + 1})`
                    }
                });
            }
            const opts = questionSource[i].options || [];
            if (
                !Number.isInteger(ans.selectedOptionIndex) ||
                ans.selectedOptionIndex < 0 ||
                ans.selectedOptionIndex >= opts.length
            ) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_INPUT', message: 'Neplatný index odpovede' }
                });
            }
        }

        const detailedResults = buildDetailedGrading(questionSource, byQuestionId);
        const correctCount = detailedResults.filter((r) => r.wasCorrect).length;
        const percentage = Math.round((correctCount / total) * 1000) / 10;

        if (quizPhase === 'followUp') {
            return res.json({
                success: true,
                data: {
                    quizPhase: 'followUp',
                    score: {
                        percentage,
                        correctCount,
                        totalCount: total
                    },
                    detailedResults
                }
            });
        }

        const wrong = detailedResults.filter((r) => !r.wasCorrect);
        let followUpQuiz = null;
        let followUpError = null;

        if (wrong.length === 0 && (raw.followUpQuiz || raw.fileLearningContent)) {
            const cleared = { ...raw };
            delete cleared.followUpQuiz;
            delete cleared.fileLearningContent;
            const { error: clearErr } = await supabase
                .from('file_metadata')
                .update({ generated_quiz: cleared })
                .eq('id', file.id);
            if (clearErr) console.error('clear followUp / file learning:', clearErr);
        }

        let fileLearningForClient = null;
        let learningError = null;

        if (wrong.length > 0) {
            try {
                const { text, isImage } = await extractDocumentText(file);
                if (isImage || !String(text).trim()) {
                    const msg = 'Zo súboru nie je dostatok textu na generovanie materiálov a doplňujúceho testu.';
                    learningError = msg;
                    followUpError = msg;
                    const merged = { ...raw };
                    delete merged.followUpQuiz;
                    delete merged.fileLearningContent;
                    const { error: clearUp } = await supabase
                        .from('file_metadata')
                        .update({ generated_quiz: merged })
                        .eq('id', file.id);
                    if (clearUp) console.error('clear quiz extras (no text):', clearUp);
                } else {
                    const testResultsForLearning = {
                        score: percentage,
                        totalQuestions: total,
                        correctAnswers: correctCount,
                        detailedAnswers: detailedResults.map((r) => ({
                            wasCorrect: r.wasCorrect,
                            questionText: r.questionText,
                            userSelectedOption: r.userSelectedOption,
                            correctOption: r.correctOption
                        }))
                    };

                    let storedLearning = null;
                    try {
                        const learned = await generateLearningContentFromFileDocument(
                            file.file_name,
                            text,
                            testResultsForLearning,
                            {}
                        );
                        storedLearning = {
                            generatedAt: new Date().toISOString(),
                            sections: learned.sections,
                            totalDuration: learned.totalDuration,
                            keyTakeaways: learned.keyTakeaways
                        };
                        fileLearningForClient = {
                            generatedAt: storedLearning.generatedAt,
                            sections: storedLearning.sections,
                            keyTakeaways: storedLearning.keyTakeaways,
                            totalDuration: storedLearning.totalDuration
                        };
                    } catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        console.error('file learning content generation:', msg);
                        learningError = msg.length > 220 ? `${msg.slice(0, 200)}…` : msg;
                    }

                    const mistakePayload = wrong.map((r) => ({
                        questionText: r.questionText,
                        userSelectedOption: r.userSelectedOption,
                        correctOption: r.correctOption
                    }));
                    const n = Math.min(8, wrong.length);
                    let followUpStored = null;
                    try {
                        const followUp = await generateFollowUpFileQuizFromMistakes(
                            file.file_name,
                            text,
                            mistakePayload,
                            n
                        );
                        followUpStored = {
                            createdAt: new Date().toISOString(),
                            testFormat: followUp.testFormat,
                            description: followUp.description,
                            questions: followUp.questions
                        };
                        followUpQuiz = {
                            description: followUpStored.description || '',
                            questionCount: followUpStored.questions.length,
                            questions: mapStoredQuestionsToClient(followUpStored.questions)
                        };
                    } catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        console.error('followUp file quiz generation:', msg);
                        followUpError = msg.length > 220 ? `${msg.slice(0, 200)}…` : msg;
                    }

                    const merged = { ...raw };
                    if (storedLearning) merged.fileLearningContent = storedLearning;
                    else delete merged.fileLearningContent;
                    if (followUpStored) merged.followUpQuiz = followUpStored;
                    else delete merged.followUpQuiz;

                    const { error: upErr } = await supabase
                        .from('file_metadata')
                        .update({ generated_quiz: merged })
                        .eq('id', file.id);
                    if (upErr) throw upErr;
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error('file quiz after-submit pipeline:', msg);
                if (!learningError) learningError = msg.length > 220 ? `${msg.slice(0, 200)}…` : msg;
                if (!followUpError) followUpError = msg.length > 220 ? `${msg.slice(0, 200)}…` : msg;
            }
        }

        return res.json({
            success: true,
            data: {
                quizPhase: 'main',
                score: { percentage, correctCount, totalCount: total },
                detailedResults,
                fileLearningContent: fileLearningForClient,
                learningError,
                followUpQuiz,
                followUpError
            }
        });
    } catch (error) {
        next(error);
    }
}
