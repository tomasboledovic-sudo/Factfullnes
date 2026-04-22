import { buildPreGeneratedLearningBundle, usesOnlyPreGeneratedLearning } from '../utils/preGeneratedLearning.js';

/** Predvolený model; prepíš v .env: GEMINI_MODEL=gemini-2.5-flash */
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function getGeminiModelId() {
    let m = String(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
    if (
        (m.startsWith('"') && m.endsWith('"')) ||
        (m.startsWith("'") && m.endsWith("'"))
    ) {
        m = m.slice(1, -1).trim();
    }
    return m || DEFAULT_GEMINI_MODEL;
}

function buildGeminiGenerateContentUrl(apiKey) {
    const model = getGeminiModelId();
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

const config = {
    language: 'slovenčina',
    maxContentChars: 2500
};

/**
 * Dodatočné zadanie pre záverečný test — len vybrané kurzy (topic id).
 * Zlepšuje konzistentnosť otázok s obsahom predmetu.
 */
const FINAL_TEST_TOPIC_DIRECTIVES = {
    1: `Záverečné otázky musia byť čisto z bunkovej biológie: rozdiel prokaryot vs eukaryot, úloha jadra a DNA, membrána a transport, mitochondrie a ATP, ribozómy a bielkoviny, špecifiká rastlinnej bunky (stena, chloroplasty, vakuola). Každá otázka nech overuje jeden konkrétny pojem alebo rozlíšenie, nie všeobecné „čo je bunka“ bez väzby na materiál.`,
    2: `Otázky nech sa týkajú výhradne Pytagorovej vety: vzťah a² + b² = c² u pravouhlého trojuholníka, pojmy prepona a odvesny, rozpoznanie kedy vzorec platí, výpočet chýbajúcej strany z dvoch známych, Pytagorejské trojuholníky. Vyhni sa otázkam z inej geometrie bez väzby na materiál.`,
    6: `Otázky majú overovať chápanie vektora ako veličiny s veľkosťou a smerom, rozdiel oproti skaláru, zápis vektora, sčítanie intuitívne alebo z kontextu materiálu, nulový vektor, modul. Nepridávaj ťažkú fyziku ani súradnice, ak nie sú v učebnom texte.`,
    7: `Zameraj sa na definíciu mocniny a zápisu aⁿ, význam základu a exponenta, pravidlá pre mocninu 0 a záporný exponent, druhú mocninu a súvis s odmocninou tam kde to vyplýva z materiálu. aspoň jedna otázka nech je výpočtová alebo na rozpoznanie správnej úpravy.`,
    8: `Otázky z výkladu o strečingu: statický vs dynamický vs ballistický, kedy čo použiť, typické trvanie statického držania, či má byť bolestivý, prínosy pre flexibilitu a rozsah pohybu. Drž sa termínov z materiálu.`,
    10: `Otázky musí rozlíšiť List (poradie, duplikáty), Set (unikátnosť, bez záruky poradia), Map (kľúč–hodnota), Vector/dynamické pole podľa textu. Overuj rozdiely v použití, nie len definície jedným vetou.`
};

function getFinalTestTopicDirective(topicData) {
    const id = typeof topicData?.id === 'number' ? topicData.id : parseInt(String(topicData?.id), 10);
    if (!Number.isFinite(id)) return '';
    return FINAL_TEST_TOPIC_DIRECTIVES[id] || '';
}

// ─── Fallback content ────────────────────────────────────────────────────────

/** Krátky fallback text ~50–100 slov k jednej chybe (bez Gemini). */
function fallbackSectionForMistake(a, topicData, index) {
    const topic = topicData.title;
    const intro = `V téme „${topic}“ si pri otázke zachytil inú odpoveď, ako vyplýva z učiva.`;
    const body = `Otázka znela: ${a.questionText} Správna možnosť je: „${a.correctOption}“. Toto tvrdenie je v súlade s definíciou a bežným použitím pojmu v rámci tejto témy. Častý omyl býva, že sa zamení súvisiaci pojem alebo sa odpoveď uhádne bez prepojenia s kontextom. Skús si predstaviť jednoduchý príklad z praxe, kde platí práve táto odpoveď, a porovnaj ho s tým, čo si zvolil ty. Opakovaním takýchto spojení si upevníš rozpoznanie správnej odpovede pri podobných otázkach.`;
    const out = `${intro} ${body}`;
    return {
        type: 'topic',
        heading: `Oblast ${index + 1}: ${topic} — oprava chyby`,
        content: out,
        order: index + 1
    };
}

function generateFallbackContent(topicData, testResults) {
    const incorrectAnswers = testResults.detailedAnswers.filter(a => !a.wasCorrect);

    const sections = [];

    if (incorrectAnswers.length > 0) {
        incorrectAnswers.slice(0, 8).forEach((a, i) => {
            sections.push(fallbackSectionForMistake(a, topicData, i));
        });
    } else {
        const base = topicData.longDescription || topicData.description;
        sections.push({
            type: 'topic',
            heading: topicData.title,
            content:
                `${base}\n\nOdpovedal si na vstupný test bez chýb. Nižšie stručne zopakujeme kľúčové súvislosti témy „${topicData.title}“ v rozsahu približne 50–100 slov: udrži si prehľad o hlavných pojmoch a ich vzájomných väzbách. Pri ďalšom štúdiu sa zameraj na príklady, ktoré ti pomôžu prepojiť teóriu s konkrétnou situáciou. Ak narazíš na nejasnosť, vráť sa k definícii a over si ju jednoduchou skúškou „platí to vždy?“. Takto si upevníš istotu pred záverečným testom.`,
            order: 1
        });
        sections.push({
            type: 'topic',
            heading: 'Tip na ďalší postup',
            content:
                `Stručne si zapíš tri pojmy z témy „${topicData.title}“, ktoré považuješ za najdôležitejšie, a ku každému jednu vetu vlastnými slovami. Tým si overíš, či rozumieš látke do hĺbky, nie len z pamäti. Odhadovaný čas na toto opakovanie je pár minút; stačí krátka poznámka, ktorú si môžeš neskôr doplniť. Krátke opakovanie o jeden deň neskôr často pomôže viac než jednorazové dlhé čítanie.`,
            order: 2
        });
    }

    return { sections, totalDuration: Math.max(sections.length * 2, 4), keyTakeaways: sections.map(s => s.heading) };
}

/** Normalizácia textu — regex /i v JS nepreklápa slovenské Ž/ž, Iná/iná atď. */
function stripForForbiddenMatch(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();
}

const FORBIDDEN_OPTION_SUBSTRINGS = [
    'ziadna z uvedenych',
    'ziadna z moznosti',
    'ziadna z nich',
    'ziadna z odpovedi',
    'ani jedna',
    'ina odpoved',
    'ina moznost',
    'vsetky su nespravne',
    'ziaden z uvedenych',
    'ziadna moznost',
    'ziadna nie je spravna',
    'zadna z uvedenych',
    'ziadne z uvedenych',
    'ziadna z predlozenych',
    'nie je spravna ani jedna'
];

export function isForbiddenFinalTestOption(s) {
    const n = stripForForbiddenMatch(s);
    return FORBIDDEN_OPTION_SUBSTRINGS.some(f => n.includes(f));
}

function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function buildFallbackFourOptions(correct, wrong, topicData, questionIndex) {
    const w = wrong && String(wrong).trim() !== String(correct).trim() ? String(wrong).trim() : null;
    const d1 =
        w ||
        `Zjednodušený výklad pojmu „${topicData.title}“, ktorý v danej situácii neplatí.`;
    const d2 = `Častý omyl pri téme „${topicData.title}“ — nezodpovedá presne otázke.`;
    const d3 = `Tvrdenie súvisiace s „${topicData.title}“, ktoré je v kontexte otázky ${questionIndex + 1} nesprávne.`;
    const raw = [String(correct).trim(), d1, d2, d3];
    const unique = [...new Set(raw)];
    while (unique.length < 4) {
        unique.push(`Doplňujúce nesprávne tvrdenie k téme „${topicData.title}“ (${unique.length}).`);
    }
    return shuffleArray(unique.slice(0, 4));
}

/** Doplnková otázka vo fallback záverečnom teste, keď je málo chýb (< 4). */
const FALLBACK_PAD_QUESTION = {
    1: 'Ktoré tvrdenie najlepšie zodpovedá úlohe jadra v zmysle učebného materiálu o bunke?',
    2: 'Pri pravouhlom trojuholníku, ktoré tvrdenie o vzťahu medzi stranami zodpovedá Pytagorovej vete?',
    6: 'Ktorá charakteristika najlepšie vystihuje vektor v porovnaní so skalárom?',
    7: 'Ktoré tvrdenie o zápise alebo výpočte mocniny je v súlade s materiálom?',
    8: 'Ktoré tvrdenie o statickom strečingu zodpovedá odporúčaniam z učebného textu?',
    10: 'Ktorá štruktúra dát je podľa materiálu vhodná na ukladanie párov kľúč–hodnota?'
};

function getFallbackPadQuestion(topicData) {
    const id = typeof topicData?.id === 'number' ? topicData.id : parseInt(String(topicData?.id), 10);
    if (Number.isFinite(id) && FALLBACK_PAD_QUESTION[id]) return FALLBACK_PAD_QUESTION[id];
    return `Čo najlepšie vystihuje pojem „${topicData.title}“ v kontexte učebného materiálu?`;
}

function generateFallbackTest(topicData, testResults) {
    const incorrectAnswers = (testResults?.detailedAnswers || []).filter(a => !a.wasCorrect);

    const questions = incorrectAnswers.slice(0, 8).map((a, i) => ({
        question: a.questionText,
        options: buildFallbackFourOptions(a.correctOption, a.userSelectedOption, topicData, i),
        correctOption: a.correctOption,
        explainsWeakness: `Overenie pochopenia: ${a.questionText}`
    }));

    while (questions.length < 4) {
        const i = questions.length;
        questions.push({
            question: getFallbackPadQuestion(topicData),
            options: buildFallbackFourOptions(
                topicData.description,
                null,
                topicData,
                i
            ),
            correctOption: topicData.description,
            explainsWeakness: 'Základné pochopenie témy'
        });
    }

    return {
        testFormat: 'mc_4',
        description: `Záverečný test: ${topicData.title}`,
        questions
    };
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildLearningPrompt(topicData, testResults) {
    const wrong = testResults.detailedAnswers.filter(a => !a.wasCorrect);
    const weaknesses = wrong.map(
        a => `- Otázka: "${a.questionText}" → správna odpoveď: "${a.correctOption}"`
    );

    const weaknessesText =
        weaknesses.length > 0
            ? weaknesses.join('\n')
            : '- Všetky odpovede boli správne — vytvor 1 až 2 krátke sekcie opakovania kľúčových pojmov tej istej témy.';

    const sectionRule =
        wrong.length > 0
            ? `Počet položiek "sections" musí byť ROVNAKÝ ako počet nesprávnych odpovedí vyššie (maximálne 8). Presne jedna JSON sekcia = jedna chyba z testu.`
            : `Vytvor presne 1 alebo 2 položky "sections" — opakovanie témy bez rozvláčnosti.`;

    return `ÚLOHA: Vytvor učebné materiály zamerané na slabé miesta používateľa (podľa vstupného testu).

TÉMA: ${topicData.title}
ÚROVEŇ: ${topicData.difficulty}

SLABÉ MIESTA (nesprávne zodpovedané):
${weaknessesText}

ŠTRUKTÚRA A DĹŽKA (povinné):
- Jazyk: ${config.language}
- ${sectionRule}
- V poli "content" každej sekcie napíš **50 až 100 slov** (nie menej ako 50, nie viac ako 100). Spočítaj slová a dodrž rozsah.
- Jedna sekcia vysvetľuje výhradne jednu súvisiacu chybu: prečo je správna odpoveď správna, kde býva omyl, jeden krátky príklad alebo analógia z bežnej situácie.
- V "heading" uveď stručný názov pojmu alebo skrátenú formuláciu problému (nie celú otázku doslovne).
- BEZ úvodu, pozdravu, záverečného zhrnutia ani oslovenia — začni priamo prvou sekciou v JSON.
- Použi markdown: **tučné** pre kľúčové pojmy, kde to pomôže čitateľnosti.

VÝSTUP - STRICT JSON:
{
  "sections": [
    {
      "heading": "Stručný názov oblasti",
      "content": "Presne 50–100 slov výkladu podľa pravidiel vyššie"
    }
  ]
}

PRAVIDLÁ:
1. Počet sections podľa počtu chýb (alebo 1–2 ak boli všetky odpovede správne)
2. Každé "content": 50–100 slov
3. Len validný JSON, žiadny text mimo JSON
4. Escape uvodzovky ako \\"

VYTVOR JSON:`;
}

/**
 * Učebné materiály pre test z nahraného súboru — výklad viaže na text dokumentu a chyby v teste.
 * testResults musí mať detailedAnswers s wasCorrect, questionText, userSelectedOption, correctOption.
 */
function buildFileDocumentLearningPrompt(fileName, documentExcerpt, testResults) {
    const wrong = (testResults?.detailedAnswers || []).filter((a) => !a.wasCorrect);
    const weaknesses = wrong.map(
        (a) =>
            `- Otázka: "${a.questionText}" — zvolená odpoveď: "${a.userSelectedOption ?? '—'}" — správne: "${a.correctOption}"`
    );
    const weaknessesText =
        weaknesses.length > 0
            ? weaknesses.join('\n')
            : '- (žiaden nesúlad — malo nenastať)';

    const sectionRule =
        wrong.length > 0
            ? `Počet položiek "sections" musí byť presne ${wrong.length} (maximálne 8) — každá sekcia = jedna chyba z testu.`
            : `Vytvor presne 1 alebo 2 "sections" — opakovanie kľúčových bodov dokumentu.`;

    return `ÚLOHA: Vytvor učebné materiály (krátke výukové sekcie) pre používateľa, ktorý z testu založeného na dokumente urobil chyby. Výklad musí vychádzať z priloženého textu dokumentu a vysvetliť, prečo bola správna odpoveď v súlade so zdrojom.

NÁZOV SÚBORU: ${fileName}

SLABÉ MIESTA (výsledok testu z dokumentu):
${weaknessesText}

TEXT DOKUMENTU (podklad pre fakty; nesiahaj za rámec, čo z neho primerane vyplýva):
---
${documentExcerpt}
---

ŠTRUKTÚRA (povinné):
- Jazyk: ${config.language}
- ${sectionRule}
- V každej "content" **50 až 100 slov**; jedna sekcia = jeden problém / jedna chyba.
- "heading" = krátky nadpis tejto oblasti (nie celé znenie otázky z testu).
- V texte použi markdown: **tučné** pre pojmy, kde to dáva zmysel.
- Začni priamo JSON, bez oslovenia a bez záveru mimo JSON.

VÝSTUP — len validný JSON:
{
  "sections": [
    { "heading": "…", "content": "50–100 slov" }
  ]
}

PRAVIDLÁ: platný JSON, escape \\"

VYTVOR JSON:`;
}

/**
 * Učebné materiály pre „test z vlastného súboru“ — AI na základe PDF/textu a chýb.
 * @param {string} fileContent
 * @param {{ detailedAnswers: Array<{ wasCorrect, questionText, userSelectedOption, correctOption }> }} testResults
 */
export async function generateLearningContentFromFileDocument(fileName, fileContent, testResults, opts = {}) {
    const allowGemini = opts.allowGemini !== false;
    if (!allowGemini) {
        return generateFallbackContent({ title: fileName, description: 'Dokument', difficulty: 'custom' }, testResults);
    }
    if (!String(fileName || '').trim() || !String(fileContent || '').trim()) {
        return generateFallbackContent({ title: fileName || 'Dokument', description: 'Dokument', difficulty: 'custom' }, testResults);
    }
    const maxChars = 12000;
    const truncated =
        fileContent.length > maxChars
            ? `${fileContent.substring(0, maxChars)}\n...[skrátené]`
            : fileContent;

    const prompt = buildFileDocumentLearningPrompt(fileName, truncated, testResults);

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const useSchema = attempt < 3;
            console.log(
                `   [súbor] Učebné materiály z dokumentu, pokus ${attempt}/3${useSchema ? ' (so schémou)' : ' (bez schémy)'}`
            );
            const raw = await callGeminiAPI(prompt, useSchema ? LEARNING_SCHEMA : null);
            const result = parseLearningResponse(raw);
            console.log(`✅ Učebné materiály zo súboru: ${result.sections.length} sekcií`);
            return result;
        } catch (err) {
            console.error(`❌ Pokus ${attempt} (materiály zo súboru):`, err.message);
            if (err?.status === 429 || err?.code === 'GEMINI_QUOTA') {
                throw err;
            }
            if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
        }
    }

    console.warn('Gemini: materiály zo súboru neúspešné — fallback.');
    return generateFallbackContent({ title: fileName, description: 'Dokument', difficulty: 'custom' }, testResults);
}

function buildMaterialQuizPrompt(fileName, documentText, questionCount) {
    return `ÚLOHA: Vytvor presne ${questionCount} otázok s výberom odpovede (4 možnosti, presne 1 správna) výhradne na základe NASLEDUJÚCEHO TEXTU z dokumentu.

NÁZOV SÚBORU: ${fileName}

TEXT DOKUMENTU (správne odpovede musia vyplývať výlučne z tohto textu, nie z všeobecných znalostí):
---
${documentText}
---

PRAVIDLÁ:
- Jazyk otázok a odpovedí: slovenčina.
- Otázky overujú porozumenie textu, fakty, súvislosti a prácu s informáciami z dokumentu.
- Každá otázka má presne 4 navzájom rôzne možnosti (krátke, konkrétne).
- Políčko "correctOption" musí byť presná kópia jednej zo štyroch možností v "options".
- Nepoužívaj formulácie typu „žiadna z uvedených možností“ ani ekvivalent.
- testFormat musí byť "mc_4".

VÝSTUP — len validný JSON v tvare:
{
  "testFormat": "mc_4",
  "description": "Jedna veta — o čom je test",
  "questions": [ /* presne ${questionCount} položiek */ ]
}

Každá položka v "questions":
{
  "question": "text otázky",
  "options": ["A", "B", "C", "D"],
  "correctOption": "presná kópia jednej z možností",
  "explainsWeakness": "stručná poznámka (1 krátka veta)"
}

VYTVOR JSON:`;
}

/**
 * Doplňujúce otázky z textu súboru — zamerané na oblasti, v ktorých používateľ v predchádzajúcom kole zlyhal.
 * @param {{ questionText: string, userSelectedOption: string | null, correctOption: string }[]} mistakes
 */
function buildFollowUpFileQuizPrompt(fileName, documentText, mistakes, questionCount) {
    const n = questionCount;
    const missBlock = mistakes
        .map(
            (m, i) =>
                `### Chyba ${i + 1}\nPôvodná otázka v teste: ${m.questionText}\nPoužívateľ odpovedal: ${m.userSelectedOption ?? '—'}\nSprávne: ${m.correctOption ?? '—'}`
        )
        .join('\n\n');
    return `ÚLOHA: V predchádzajúcom teste z dokumentu používateľ zodpovedal nesprávne v ${mistakes.length} prípadoch. Vygeneruj presne ${n} NOVÝCH otázok s výberom odpovede (4 možnosti, presne 1 správna), ktoré cielia na rovnaké témy a súvislosti, ktoré tieto chyby odhaľujú. Znenia NOVÝCH otázok sa musia líšiť od pôvodných formulácií, ale odpovede musia byť stále overiteľné z textu dokumentu (nie z vedomostí mimo zdroj).

NÁZOV SÚBORU: ${fileName}

KONTEXT CHÝB (použi ako smerovanie, nie na kopírovanie znenia):
${missBlock}

TEXT DOKUMENTU (všetky správne odpovede musia vyplývať z tohto textu; ak je text skrátený, dávaj obozretné otázky k dostupným pasážam):
---
${documentText}
---

PRAVIDLÁ:
- Jazyk: slovenčina; testFormat: "mc_4".
- Každá otázka: presne 4 navzájom rôzne možnosti; "correctOption" presná kópia jednej z možností.
- Cieľ: preveriť porozumenie v oblastiach, kde boli chyby, nie opakovať tú istú otázku slovom od slova.
- Nepoužívaj „žiadna z uvedených“ ani ekvivalent.

VÝSTUP — len validný JSON:
{
  "testFormat": "mc_4",
  "description": "1–2 vety: čo cieli tento doplňujúci test",
  "questions": [ /* presne ${n} položiek, formát rovnaký ako pri štandardnom teste z dokumentu */ ]
}

Každá položka:
{
  "question": "…",
  "options": ["…", "…", "…", "…"],
  "correctOption": "…",
  "explainsWeakness": "1 krátka veta (voliteľné)"
}

VYTVOR JSON:`;
}

/**
 * Doplňujúci test z nahraného súboru — podľa chýb z predchádzajúceho kola.
 * @param {Array<{ questionText: string, userSelectedOption: string | null, correctOption: string }>} mistakes
 */
export async function generateFollowUpFileQuizFromMistakes(
    fileName,
    fileContent,
    mistakes,
    questionCount
) {
    if (!Array.isArray(mistakes) || mistakes.length === 0) {
        throw new Error('Pre doplňujúci test chýbajú chyby z predchádzajúceho kola.');
    }
    const n = Math.min(8, Math.max(1, Math.min(Number(questionCount) || mistakes.length, mistakes.length)));
    const maxChars = 12000;
    const truncated =
        fileContent.length > maxChars
            ? `${fileContent.substring(0, maxChars)}\n...[skrátené]`
            : fileContent;
    if (!truncated.trim()) {
        throw new Error('Text dokumentu je prázdny — nedá sa vytvoriť doplňujúci test.');
    }

    const prompt = buildFollowUpFileQuizPrompt(fileName, truncated, mistakes, n);
    const schema = buildTestSchema(n);
    const fakeTopic = { title: fileName, description: '', difficulty: 'custom' };
    const emptyLearning = { sections: [] };

    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const useSchema = attempt === 1;
            console.log(
                `   [materiál] Doplňujúci test po chybách (${n} otázok), pokus ${attempt}/3${useSchema ? ' (so schémou)' : ' (bez schémy)'}`
            );
            const raw = await callGeminiAPI(prompt, useSchema ? schema : null);
            const result = parseFinalTestResponse(raw, fakeTopic, emptyLearning, n);
            console.log(`✅ Doplňujúci test z materiálu: ${result.questions.length} otázok`);
            return result;
        } catch (err) {
            lastErr = err;
            console.error(`❌ Pokus ${attempt}/3 (doplňujúci test z materiálu):`, err.message);
            if (err?.status === 429 || err?.code === 'GEMINI_QUOTA') {
                throw err;
            }
            if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
        }
    }

    const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
    const combined = `Nepodarilo sa vygenerovať doplňujúci test (Gemini). ${detail || 'Skús to znova.'}`;
    throw new Error(combined.length > 600 ? combined.slice(0, 580) + '…' : combined);
}

function buildFinalTestPrompt(topicData, learningContent, originalTestResults) {
    const wrong = (originalTestResults?.detailedAnswers || []).filter((a) => !a.wasCorrect);
    const weaknessCount = wrong.length;
    const sectionsText = learningContent.sections
        .map(s => `### ${s.heading}\n${s.content}`)
        .join('\n\n');
    const topicDirective = getFinalTestTopicDirective(topicData);
    const directiveBlock =
        topicDirective.trim().length > 0
            ? `\nŠPECIFICKÉ ZAMERANIE PRE TÚTO TÉMU (dodrž presne):\n${topicDirective}\n`
            : '';

    return `ÚLOHA: Vytvor záverečný test v štýle školského kvízu — štvormožnostové otázky podľa učebného materiálu.

TÉMA: ${topicData.title}
JAZYK: ${config.language}${directiveBlock}
POČET CHÝB NA VSTUPNOM TESTE: ${weaknessCount}
- Vygeneruj presne ${weaknessCount} otázok — každá musí zodpovedať jednej oblasti z učebného materiálu nižšie (materiál je len o týchto chybách).

UČEBNÝ MATERIÁL (test MUSÍ z neho vychádzať):
${sectionsText}

FORMÁT (vždy rovnaký):
- Na začiatku JSON uveď "testFormat": "mc_4" (výhradne tento formát).
- Každá otázka má presne 4 možnosti odpovede.

OTÁZKY („question“):
- Jedna jasná otázka v štýle testu (jedna súvislá veta alebo krátke súvislé vety).
- Bez meta-textu typu „Vyber správnu odpoveď k nasledujúcemu:“ — rovno znenie otázky.
- Testujú pochopenie látky z materiálu, nie náhodné fakty mimo témy.

MOŽNOSTI („options“):
- Presne 4 reťazce; každý je samostatná, úplná odpoveď alebo tvrdenie (nie len písmeno A–D).
- Podobná dĺžka a štýl (približne 5–25 slov na možnosť), všetky štyri zmysluplné a konkrétne.
- Presne jedna možnosť je správna a musí sa presne zhodovať s "correctOption".

ZAKÁZANÉ v možnostiach:
- „žiadna z uvedených“, „ani jedna“, „iná odpoveď“, „iná možnosť“, prázdne alebo jednoslovné výhybky, všeobecné vety bez väzby na látku.

POČET:
- Presne ${weaknessCount} otázok (nie viac, nie menej).

VÝSTUP - STRICT JSON:
{
  "testFormat": "mc_4",
  "description": "Záverečný test",
  "questions": [
    {
      "question": "Konkrétna otázka z látky?",
      "options": [
        "Prvá plnohodnotná odpoveď",
        "Druhá plnohodnotná odpoveď",
        "Tretia plnohodnotná odpoveď",
        "Štvrtá plnohodnotná odpoveď"
      ],
      "correctOption": "Prvá plnohodnotná odpoveď",
      "explainsWeakness": "Čo otázka overuje"
    }
  ]
}

PRAVIDLÁ:
1. testFormat je vždy "mc_4".
2. Každá otázka: presne 4 položky v "options", všetky rôzne.
3. correctOption musí byť presná kópia jednej z možností.
4. Len validný JSON; escape uvodzovky ako \\"

VYTVOR JSON:`;
}

// ─── Gemini API call ──────────────────────────────────────────────────────────

async function callGeminiAPI(prompt, schema) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY nie je nastavený');

    const url = buildGeminiGenerateContentUrl(apiKey);

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.1,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            ...(schema ? { responseSchema: schema } : {})
        }
    };

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout (55s)')), 55000)
    );

    const fetchPromise = fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || response.statusText;
        if (response.status === 429) {
            const e = new Error(
                'Prekročená kvóta Gemini API (bezplatný plán alebo vyčerpaný limit). ' +
                    'Skús neskôr; v Google AI Studio alebo Google Cloud skontroluj Usage a prípadne zapni fakturáciu (paid tier). ' +
                    `Na Verceli v premenných prostredia nastav napr. GEMINI_MODEL=gemini-2.5-flash (teraz: ${getGeminiModelId()}). ` +
                    'Ak API hlási limit 0 pri free tier, tento model tam nemusí byť dostupný. ' +
                    'Viac: https://ai.google.dev/gemini-api/docs/rate-limits'
            );
            e.status = 429;
            e.code = 'GEMINI_QUOTA';
            throw e;
        }
        const modelHint =
            response.status === 404
                ? ` Skontroluj GEMINI_MODEL (teraz: ${getGeminiModelId()}) — na Google AI Studio musí model existovať.`
                : '';
        throw new Error(`Gemini API error ${response.status}: ${msg}.${modelHint}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
        const br = data.promptFeedback?.blockReason;
        if (br) {
            throw new Error(`Gemini API: odpoveď zablokovaná (${br}). Skús kratší dokument alebo iný súbor.`);
        }
        throw new Error('Gemini API: žiadny kandidát v odpovedi (kvóta, filter alebo prázdny výstup).');
    }
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

function replaceForbiddenOptions(question, topicData, learningContent, qIndex) {
    const headings = (learningContent?.sections || [])
        .map(s => (s.heading || '').trim())
        .filter(Boolean);
    let options = Array.isArray(question.options) ? [...question.options] : [];
    const correct = String(question.correctOption || '').trim();
    const n = options.length === 2 ? 2 : 4;

    let fillN = 0;
    options = options.map(o => {
        const t = String(o ?? '').trim();
        if (t === correct) return t;
        if (!t || isForbiddenFinalTestOption(t)) {
            const h = headings[fillN % Math.max(headings.length, 1)] || topicData.title;
            fillN += 1;
            if (n === 2) {
                return fillN % 2 === 1
                    ? `Nesprávne tvrdenie k téme „${topicData.title}“ (otázka ${qIndex + 1}).`
                    : `Iné nesprávne tvrdenie podľa časti „${h}“.`;
            }
            return `Podľa časti „${h}“ (${fillN}) — tvrdenie, ktoré pri tejto otázke neplatí.`;
        }
        return t;
    });

    let unique = [...new Set(options)];
    if (!unique.includes(correct) && correct) {
        unique = [correct, ...unique.filter(o => o !== correct)];
    }
    while (unique.length < n) {
        unique.push(
            `Nesprávne tvrdenie k „${topicData.title}“ (variant ${unique.length + 1}).`
        );
    }
    unique = unique.slice(0, n);
    if (correct && !unique.includes(correct)) unique[0] = correct;

    return { ...question, options: shuffleArray(unique), correctOption: correct || unique[0] };
}

/**
 * Opraví uložený záverečný test: zakázané možnosti nahradí zmysluplnými (bez zmeny poradia indexov).
 * Používa sa pri parsovaní odpovede z AI aj pri čítaní starých relácií z DB.
 */
export function sanitizeFinalTestForSession(finalTest, topicTitle, sections) {
    if (!finalTest?.questions?.length) return finalTest;

    const headings = (sections || []).map(s => (s.heading || '').trim()).filter(Boolean);
    const tt = topicTitle || 'téma';

    let fmt = finalTest.testFormat;
    if (fmt !== 'binary_2' && fmt !== 'mc_4') {
        const lens = finalTest.questions.map(q => (q.options || []).length);
        const uniq = [...new Set(lens)];
        if (uniq.length === 1 && uniq[0] === 2) fmt = 'binary_2';
        else if (uniq.length === 1 && uniq[0] === 4) fmt = 'mc_4';
        else fmt = (lens[0] === 2) ? 'binary_2' : 'mc_4';
    }
    const optionCount = fmt === 'binary_2' ? 2 : 4;

    const numericWrong = (correct, salt) => {
        const bare = String(correct).replace(/\s/g, '');
        if (!/^\d+$/.test(bare)) return null;
        const n = Number(bare);
        const pool = [n * 2, n + 10, n - 1, n + 1, n + 11, n * 10, Math.floor(n / 2) || 1].map(String);
        const pick = pool[salt % pool.length];
        return pick === bare ? String(n + 37 + salt) : pick;
    };

    const textWrong = (qi, salt) => {
        const h = headings[salt % Math.max(headings.length, 1)] || tt;
        return `Nesprávne tvrdenie podľa časti „${h}“ (otázka ${qi + 1}, variant ${salt + 1}).`;
    };

    const questions = finalTest.questions.map((q, qi) => {
        const correct = String(q.correctOption || '').trim();
        let options = (q.options || []).map(o => String(o).trim());
        if (options.length > optionCount) options = options.slice(0, optionCount);
        while (options.length < optionCount) options.push('');

        let salt = qi * 4;
        options = options.map((opt, oi) => {
            if (opt === correct) return opt;
            if (opt && !isForbiddenFinalTestOption(opt)) return opt;
            salt += 1;
            return numericWrong(correct, salt + oi) || textWrong(qi, salt + oi);
        });

        const used = new Set();
        options = options.map((opt, oi) => {
            let o = opt;
            let bump = 0;
            while (
                (used.has(o) && o !== correct) ||
                (o !== correct && isForbiddenFinalTestOption(o))
            ) {
                bump += 1;
                salt += 1;
                o = numericWrong(correct, salt + bump + oi) || textWrong(qi, salt + bump + oi);
                if (bump > 25) break;
            }
            used.add(o);
            return o;
        });

        if (correct && !options.includes(correct)) {
            const j = options.findIndex(x => x !== correct);
            if (j >= 0) options[j] = correct;
            else options[0] = correct;
        }

        return { ...q, options, correctOption: correct };
    });

    return { ...finalTest, testFormat: fmt, questions };
}

function parseFinalTestResponse(responseText, topicData, learningContent, expectedQuestionCount) {
    const parsed = extractJSON(responseText);

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error('Neplatná štruktúra: chýba questions pole');
    }

    let rawQuestions = parsed.questions;
    if (rawQuestions.length > expectedQuestionCount) {
        rawQuestions = rawQuestions.slice(0, expectedQuestionCount);
    }
    if (rawQuestions.length < expectedQuestionCount) {
        throw new Error(
            `Očakávaných ${expectedQuestionCount} otázok, model vrátil ${parsed.questions.length}`
        );
    }

    const testFormat = 'mc_4';
    const expectedLen = 4;

    const questions = rawQuestions.map((q, i) => {
        if (!q.question || !Array.isArray(q.options)) {
            throw new Error(`Otázka ${i + 1}: chýba question alebo options`);
        }
        if (q.options.length !== expectedLen) {
            throw new Error(
                `Otázka ${i + 1}: pri testFormat=${testFormat} musí mať presne ${expectedLen} možnosti, je ${q.options.length}`
            );
        }
        const opts = q.options.map(o => String(o).trim());
        if (new Set(opts).size !== expectedLen) {
            throw new Error(`Otázka ${i + 1}: možnosti musia byť navzájom rôzne`);
        }
        const correct = String(q.correctOption || '').trim();
        if (!opts.includes(correct)) {
            throw new Error(`Otázka ${i + 1}: correctOption nie je medzi options`);
        }
        if (opts.some(o => isForbiddenFinalTestOption(o))) {
            return replaceForbiddenOptions({ ...q, options: opts, correctOption: correct }, topicData, learningContent, i);
        }
        return { ...q, options: opts, correctOption: correct };
    });

    return sanitizeFinalTestForSession(
        {
            testFormat,
            description: parsed.description || 'Záverečný test',
            questions
        },
        topicData.title,
        learningContent?.sections
    );
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

const TEST_SCHEMA_BASE = {
    type: 'object',
    properties: {
        testFormat: {
            type: 'string',
            enum: ['mc_4'],
            description: 'Výhradne štvormožnostový test'
        },
        description: { type: 'string' },
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    question: { type: 'string' },
                    options: {
                        type: 'array',
                        items: { type: 'string' },
                        minItems: 4,
                        maxItems: 4
                    },
                    correctOption: { type: 'string' },
                    explainsWeakness: { type: 'string' }
                },
                required: ['question', 'options', 'correctOption']
            },
            minItems: 1,
            maxItems: 8
        }
    },
    required: ['testFormat', 'description', 'questions']
};

function buildTestSchema(expectedCount) {
    return {
        ...TEST_SCHEMA_BASE,
        properties: {
            ...TEST_SCHEMA_BASE.properties,
            questions: {
                ...TEST_SCHEMA_BASE.properties.questions,
                minItems: expectedCount,
                maxItems: expectedCount
            }
        }
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateLearningContent(topicData, testResults, opts = {}) {
    const allowGemini = opts.allowGemini !== false;

    if (usesOnlyPreGeneratedLearning(topicData)) {
        console.log(`Učebné materiály (predpripravené, bez AI): ${topicData.title}`);
        const bundle = buildPreGeneratedLearningBundle(topicData, testResults);
        if (bundle) return bundle;
        console.warn('Predpripravený materiál sa nepodarilo zostaviť — lokálny fallback.');
        return generateFallbackContent(topicData, testResults);
    }

    if (!allowGemini) {
        console.log(`Učebné materiály bez Gemini API (obmedzenie na správcu): ${topicData.title}`);
        return generateFallbackContent(topicData, testResults);
    }

    console.log(`Generujem učebné materiály (AI) pre: ${topicData.title}`);
    const prompt = buildLearningPrompt(topicData, testResults);

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const useSchema = attempt < 3;
            console.log(`   Pokus ${attempt}/3${useSchema ? ' (so schémou)' : ' (bez schémy)'}`);
            const raw = await callGeminiAPI(prompt, useSchema ? LEARNING_SCHEMA : null);
            const result = parseLearningResponse(raw);
            console.log(`Vygenerovaných ${result.sections.length} sekcií`);
            return result;
        } catch (err) {
            console.error(`Pokus ${attempt} zlyhal:`, err.message);
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.warn('Gemini nevrátil platný obsah po 3 pokusoch — používam lokálny fallback.');
    return generateFallbackContent(topicData, testResults);
}

/**
 * AI zhrnutie nahraného súboru (endpoint /api/files/:id/summarize).
 * Používa rovnaký model ako zvyšok aplikácie (GEMINI_MODEL / predvolený gemini-2.5-flash).
 */
export async function summarizeUploadedDocument(fileContent, fileName) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY nie je nastavený');

    const maxChars = 30000;
    const truncated =
        fileContent.length > maxChars ? fileContent.substring(0, maxChars) + '\n...[skrátené]' : fileContent;

    const prompt = `Vytvor podrobné zhrnutie nasledujúceho dokumentu (${fileName}).

Obsah súboru:
${truncated}

Prosím, uveď:
1. Stručný prehľad obsahu
2. Kľúčové body a hlavné témy
3. Dôležité detaily alebo zistenia
4. Celkové zhrnutie

Odpovedaj v slovenčine. Formátuj odpoveď prehľadne s nadpismi.`;

    const url = buildGeminiGenerateContentUrl(apiKey);
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
        const hint =
            response.status === 404
                ? ` Skontroluj názov modelu v .env (GEMINI_MODEL, teraz: ${getGeminiModelId()}).`
                : '';
        throw new Error(
            `Gemini API ${response.status}: ${err.error?.message || response.statusText}.${hint}`
        );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error(
            'Gemini API: prázdna odpoveď (kvóta, bezpečnostný filter alebo prázdny výstup).'
        );
    }
    return text;
}

/**
 * Vygeneruje viacnásobný test (4 možnosti) z textu nahraného súboru.
 * @param {string} fileName
 * @param {string} fileContent
 * @param {number} [questionCount=8] 4–10
 */
export async function generateQuizFromFileContent(fileName, fileContent, questionCount = 8) {
    const n = Math.min(10, Math.max(4, Number(questionCount) || 8));
    /** Kratší vstup = menej input tokenov (nižšia záťaž na free tier). */
    const maxChars = 14000;
    const truncated =
        fileContent.length > maxChars ? `${fileContent.substring(0, maxChars)}\n...[skrátené]` : fileContent;
    if (!truncated.trim()) {
        throw new Error('Text dokumentu je prázdny — zo súboru sa nedá vytvoriť test.');
    }

    const prompt = buildMaterialQuizPrompt(fileName, truncated, n);
    const schema = buildTestSchema(n);
    const fakeTopic = { title: fileName, description: '', difficulty: 'custom' };
    const emptyLearning = { sections: [] };

    let lastErr;
    /** Schéma structured output občas zlyhá (model, veľkosť); 2.–3. pokus bez schémy — spoľahlivejšie na produkcii. */
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const useSchema = attempt === 1;
            console.log(
                `   [materiál] Generujem test z dokumentu (${n} otázok), pokus ${attempt}/3${useSchema ? ' (so schémou)' : ' (bez schémy)'}`
            );
            const raw = await callGeminiAPI(prompt, useSchema ? schema : null);
            const result = parseFinalTestResponse(raw, fakeTopic, emptyLearning, n);
            console.log(`✅ Test z materiálu: ${result.questions.length} otázok`);
            return result;
        } catch (err) {
            lastErr = err;
            console.error(`❌ Pokus ${attempt}/3 (test z materiálu):`, err.message);
            if (err?.status === 429 || err?.code === 'GEMINI_QUOTA') {
                throw err;
            }
            if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
        }
    }

    const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
    const combined = `Nepodarilo sa vygenerovať test z dokumentu (Gemini). ${detail || 'Skús to znova.'}`;
    throw new Error(combined.length > 600 ? combined.slice(0, 580) + '…' : combined);
}

export async function generateFinalTest(topicData, learningContent, originalTestResults, opts = {}) {
    const allowGemini = opts.allowGemini !== false;
    const wrong = (originalTestResults?.detailedAnswers || []).filter((a) => !a.wasCorrect);
    if (wrong.length === 0) {
        console.log(`✅ Záverečný test sa nevyžaduje (vstupný test bez chýb): ${topicData.title}`);
        return {
            testFormat: 'mc_4',
            description: `Vstupný test témy „${topicData.title}“ bez chýb — záverečný test nie je potrebný.`,
            questions: []
        };
    }

    if (!allowGemini) {
        console.log(`Záverečný test bez Gemini API (obmedzenie na správcu): ${topicData.title}`);
        const fb = generateFallbackTest(topicData, originalTestResults);
        return sanitizeFinalTestForSession(fb, topicData.title, learningContent?.sections);
    }

    const expectedQ = wrong.length;
    console.log(`🤖 Generujem záverečný test (${expectedQ} otázok) pre: ${topicData.title}`);
    const prompt = buildFinalTestPrompt(topicData, learningContent, originalTestResults);
    const schema = buildTestSchema(expectedQ);

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`   Pokus ${attempt}/3...`);
            const raw = await callGeminiAPI(prompt, schema);
            const result = parseFinalTestResponse(raw, topicData, learningContent, expectedQ);
            console.log(`✅ Vygenerovaných ${result.questions.length} otázok`);
            return result;
        } catch (err) {
            console.error(`❌ Pokus ${attempt} zlyhal:`, err.message);
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log('🔄 Používam fallback test...');
    const fb = generateFallbackTest(topicData, originalTestResults);
    return sanitizeFinalTestForSession(fb, topicData.title, learningContent?.sections);
}
