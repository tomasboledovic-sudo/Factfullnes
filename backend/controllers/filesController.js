import supabase from '../services/supabaseClient.js';

const BUCKET = 'files';

// Ensure the storage bucket exists
async function ensureBucket() {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET);
    if (!exists) {
        await supabase.storage.createBucket(BUCKET, { public: false });
    }
}

/**
 * GET /api/files
 */
export async function listFiles(req, res, next) {
    try {
        const { data, error } = await supabase
            .from('file_metadata')
            .select('*')
            .order('uploaded_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, data: data || [] });
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

        await ensureBucket();

        const ext = req.file.originalname.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = `uploads/${fileName}`;

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
        next(error);
    }
}

/**
 * DELETE /api/files/:id
 */
export async function deleteFile(req, res, next) {
    try {
        const { id } = req.params;

        const { data: file, error: fetchErr } = await supabase
            .from('file_metadata').select('*').eq('id', id).maybeSingle();
        if (fetchErr || !file) {
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
            .from('file_metadata').select('*').eq('id', id).maybeSingle();
        if (fetchErr || !file) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Súbor neexistuje' } });
        }

        // Download file from storage
        const { data: fileBlob, error: dlErr } = await supabase.storage
            .from(BUCKET).download(file.file_path);
        if (dlErr) throw dlErr;

        const arrayBuffer = await fileBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Extract text
        let fileContent = '';
        const lower = file.file_name.toLowerCase();

        if (lower.endsWith('.pdf') || file.file_type === 'application/pdf') {
            const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
            const result = await pdfParse(buffer);
            fileContent = result.text;
        } else if (file.file_type.startsWith('image/')) {
            fileContent = `[Obrázok: ${file.file_name}]`;
        } else {
            fileContent = buffer.toString('utf8');
        }

        if (!fileContent.trim()) {
            return res.status(422).json({ success: false, error: { code: 'EMPTY_CONTENT', message: 'Zo súboru sa nepodarilo extrahovať text' } });
        }

        // Summarize with Gemini
        const summary = await callGeminiSummarize(fileContent, file.file_name);
        res.json({ success: true, data: { summary, fileName: file.file_name } });
    } catch (error) {
        next(error);
    }
}

async function callGeminiSummarize(fileContent, fileName) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY nie je nastavený');

    const maxChars = 30000;
    const truncated = fileContent.length > maxChars ? fileContent.substring(0, maxChars) + '\n...[skrátené]' : fileContent;

    const prompt = `Vytvor podrobné zhrnutie nasledujúceho dokumentu (${fileName}).

Obsah súboru:
${truncated}

Prosím, uveď:
1. Stručný prehľad obsahu
2. Kľúčové body a hlavné témy
3. Dôležité detaily alebo zistenia
4. Celkové zhrnutie

Odpovedaj v slovenčine. Formátuj odpoveď prehľadne s nadpismi.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error ${response.status}: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini API: prázdna odpoveď');
    return text;
}
