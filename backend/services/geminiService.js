const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const config = {
    language: 'slovenčina',
    maxContentChars: 2500,
    finalTestQuestions: 8
};

// ─── Fallback content ────────────────────────────────────────────────────────

function generateFallbackContent(topicData, testResults) {
    const incorrectAnswers = testResults.detailedAnswers.filter(a => !a.wasCorrect);
    const correctAnswers = testResults.detailedAnswers.filter(a => a.wasCorrect);

    const sections = [];

    if (incorrectAnswers.length > 0) {
        sections.push({
            type: 'topic',
            heading: `Prehľad témy: ${topicData.title}`,
            content: `${topicData.longDescription || topicData.description}\n\nV tejto téme sa zameriame na oblasti, kde máš priestor na zlepšenie.`,
            order: 1
        });

        incorrectAnswers.slice(0, 3).forEach((a, i) => {
            sections.push({
                type: 'topic',
                heading: `Správna odpoveď na otázku ${i + 1}`,
                content: `**Otázka:** ${a.questionText}\n\n**Správna odpoveď:** ${a.correctOption}\n\nZapamätaj si túto odpoveď — je dôležitá pre pochopenie tejto témy.`,
                order: i + 2
            });
        });
    } else {
        sections.push({
            type: 'topic',
            heading: topicData.title,
            content: topicData.longDescription || topicData.description,
            order: 1
        });
        sections.push({
            type: 'topic',
            heading: 'Výborný výsledok!',
            content: `Odpovedal si správne na všetky otázky v téme **${topicData.title}**. Pozri si kľúčové pojmy ešte raz pre pevnejšie porozumenie.`,
            order: 2
        });
    }

    return { sections, totalDuration: sections.length * 2, keyTakeaways: sections.map(s => s.heading) };
}

function generateFallbackTest(topicData, testResults) {
    const incorrectAnswers = (testResults?.detailedAnswers || []).filter(a => !a.wasCorrect);

    const questions = incorrectAnswers.slice(0, 8).map((a, i) => ({
        question: a.questionText,
        options: shuffleOptions(a.correctOption, a.userSelectedOption),
        correctOption: a.correctOption,
        explainsWeakness: `Overenie pochopenia: ${a.questionText}`
    }));

    while (questions.length < 4) {
        questions.push({
            question: `Čo opisuje pojem "${topicData.title}"?`,
            options: [
                topicData.description,
                'Proces fotosyntézy',
                'Typ chemickej reakcie',
                'Matematická funkcia'
            ],
            correctOption: topicData.description,
            explainsWeakness: 'Základné pochopenie témy'
        });
    }

    return { description: `Záverečný test: ${topicData.title}`, questions };
}

function shuffleOptions(correct, wrong) {
    const options = [correct, wrong, `Iná možnosť`, `Žiadna z uvedených`];
    return options.sort(() => Math.random() - 0.5);
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildLearningPrompt(topicData, testResults) {
    const weaknesses = testResults.detailedAnswers
        .filter(a => !a.wasCorrect)
        .map(a => `- "${a.questionText}" (správna odpoveď: "${a.correctOption}")`);

    const weaknessesText = weaknesses.length > 0
        ? weaknesses.join('\n')
        : '- Používateľ odpovedal správne na všetky otázky — zosumarizuj kľúčové pojmy témy.';

    return `ÚLOHA: Vytvor učebné materiály zamerané VÝHRADNE na slabé miesta používateľa.

TÉMA: ${topicData.title}
ÚROVEŇ: ${topicData.difficulty}

SLABÉ MIESTA (čo nevedel):
${weaknessesText}

POŽIADAVKY:
- Jazyk: ${config.language}
- Celková dĺžka textu: 250–450 slov (polovica až jedna A4)
- Rozdeľ obsah do 2–4 tematických sekcií podľa pojmov z chýb
- Každá sekcia = jeden konkrétny pojem alebo téma
- BEZ akéhokoľvek úvodu, pozdravu alebo privítania
- BEZ záverečného zhrnutia
- Začni PRIAMO prvou sekciou
- Používaj príklady z reálneho života
- Použi markdown: tučné písmo pre kľúčové pojmy, odrážky pre zoznamy

VÝSTUP - STRICT JSON:
{
  "sections": [
    {
      "heading": "Názov pojmu alebo témy",
      "content": "Vysvetlenie s príkladmi (60–120 slov)"
    }
  ]
}

PRAVIDLÁ:
1. 2 až 4 sections, každá o inej téme
2. Žiadny text mimo JSON
3. Validný JSON
4. Escape uvodzovky ako \\"

VYTVOR JSON:`;
}

function buildFinalTestPrompt(topicData, learningContent, originalTestResults) {
    const sectionsText = learningContent.sections
        .map(s => `### ${s.heading}\n${s.content}`)
        .join('\n\n');

    return `ÚLOHA: Vytvor záverečný test na základe učebného materiálu.

TÉMA: ${topicData.title}
JAZYK: ${config.language}

UČEBNÝ MATERIÁL (z ktorého MUSÍ vychádzať test):
${sectionsText}

POŽIADAVKY:
- Vytvor presne ${config.finalTestQuestions} testových otázok
- Každá otázka MUSÍ vychádzať z učebného materiálu vyššie
- Každá otázka má 4 možnosti (A, B, C, D)
- Presne jedna odpoveď je správna
- Otázky majú testovať pochopenie, nie len pamäť

VÝSTUP - STRICT JSON:
{
  "description": "Záverečný test",
  "questions": [
    {
      "question": "Text otázky?",
      "options": ["Možnosť A", "Možnosť B", "Možnosť C", "Možnosť D"],
      "correctOption": "Možnosť A",
      "explainsWeakness": "Čo táto otázka testuje"
    }
  ]
}

PRAVIDLÁ:
1. Žiadny text mimo JSON
2. Validný JSON
3. correctOption musí byť PRESNE rovnaký text ako jedna z options
4. Escape uvodzovky ako \\"

VYTVOR JSON:`;
}

// ─── Gemini API call ──────────────────────────────────────────────────────────

async function callGeminiAPI(prompt, schema) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY nie je nastavený');

    const url = `${GEMINI_API_URL}?key=${apiKey}`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
            ...(schema ? { responseSchema: schema } : {})
        }
    };

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout (45s)')), 45000)
    );

    const fetchPromise = fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error ${response.status}: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate) throw new Error('Gemini API: žiadny kandidát v odpovedi');
    if (candidate.finishReason === 'MAX_TOKENS') throw new Error('Gemini API: prekročený limit tokenov');
    if (!candidate.content?.parts?.[0]?.text) throw new Error('Gemini API: prázdna odpoveď');

    return candidate.content.parts[0].text;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function extractJSON(text) {
    let cleaned = text.trim().replace(/^\uFEFF/, '');

    // Remove markdown code fences
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    // Fix trailing commas
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Balance braces
    const open = (cleaned.match(/\{/g) || []).length;
    const close = (cleaned.match(/\}/g) || []).length;
    const openArr = (cleaned.match(/\[/g) || []).length;
    const closeArr = (cleaned.match(/\]/g) || []).length;
    cleaned += '}'.repeat(Math.max(0, open - close));
    cleaned += ']'.repeat(Math.max(0, openArr - closeArr));

    return JSON.parse(cleaned);
}

function parseLearningResponse(responseText) {
    const parsed = extractJSON(responseText);

    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
        throw new Error('Neplatná štruktúra: chýba sections pole');
    }

    const sections = parsed.sections.map((s, i) => ({
        type: 'topic',
        heading: s.heading || `Sekcia ${i + 1}`,
        content: s.content || '',
        order: i + 1
    }));

    return {
        sections,
        totalDuration: sections.length * 2,
        keyTakeaways: sections.map(s => s.heading)
    };
}

function parseFinalTestResponse(responseText) {
    const parsed = extractJSON(responseText);

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error('Neplatná štruktúra: chýba questions pole');
    }

    return {
        description: parsed.description || 'Záverečný test',
        questions: parsed.questions
    };
}

// ─── Schema definitions ───────────────────────────────────────────────────────

const LEARNING_SCHEMA = {
    type: 'object',
    properties: {
        sections: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    heading: { type: 'string' },
                    content: { type: 'string' }
                },
                required: ['heading', 'content']
            }
        }
    },
    required: ['sections']
};

const TEST_SCHEMA = {
    type: 'object',
    properties: {
        description: { type: 'string' },
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    question: { type: 'string' },
                    options: { type: 'array', items: { type: 'string' } },
                    correctOption: { type: 'string' },
                    explainsWeakness: { type: 'string' }
                },
                required: ['question', 'options', 'correctOption']
            }
        }
    },
    required: ['description', 'questions']
};

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateLearningContent(topicData, testResults) {
    console.log(`🤖 Generujem učebné materiály pre: ${topicData.title}`);
    const prompt = buildLearningPrompt(topicData, testResults);

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`   Pokus ${attempt}/3...`);
            const raw = await callGeminiAPI(prompt, LEARNING_SCHEMA);
            const result = parseLearningResponse(raw);
            console.log(`✅ Vygenerovaných ${result.sections.length} sekcií`);
            return result;
        } catch (err) {
            console.error(`❌ Pokus ${attempt} zlyhal:`, err.message);
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log('🔄 Používam fallback obsah...');
    return generateFallbackContent(topicData, testResults);
}

export async function generateFinalTest(topicData, learningContent, originalTestResults) {
    console.log(`🤖 Generujem záverečný test pre: ${topicData.title}`);
    const prompt = buildFinalTestPrompt(topicData, learningContent, originalTestResults);

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`   Pokus ${attempt}/3...`);
            const raw = await callGeminiAPI(prompt, TEST_SCHEMA);
            const result = parseFinalTestResponse(raw);
            console.log(`✅ Vygenerovaných ${result.questions.length} otázok`);
            return result;
        } catch (err) {
            console.error(`❌ Pokus ${attempt} zlyhal:`, err.message);
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log('🔄 Používam fallback test...');
    return generateFallbackTest(topicData, originalTestResults);
}
