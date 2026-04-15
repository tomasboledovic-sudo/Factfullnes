import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
const preDir = path.join(dataDir, 'preGeneratedLearning');
const ptqPath = path.join(dataDir, 'preTestQuestions.json');

function pq(tid, n, text, options, correctAnswer, questionType = 'multiple_choice') {
 return {
        id: `q${n}-pre-topic${tid}`,
        topicId: tid,
        questionText: text,
        questionType,
        options,
        correctAnswer,
        order: n
    };
}

function ft(desc, questions) {
    return {
        testFormat: 'mc_4',
        description: desc,
        questions
    };
}

function ftq(question, options, correctOption, explainsWeakness) {
    return { question, options, correctOption, explainsWeakness };
}

function wordCount(s) {
    return String(s || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

function addonHash(salt) {
    let h = 0;
    for (let i = 0; i < salt.length; i++) h = (h * 31 + salt.charCodeAt(i)) >>> 0;
    return h;
}

/** Doplnkové odseky aby výklad držal približne 50–100 slov (jadrá z L() sú často kratšie). */
const LEARNING_ADDONS = [
    '**Ako si to upevniť:** Napíš jednu vlastnú vetu, kde použiješ presne pravidlo z odseka vyššie — napríklad mini-príklad z nákupu, z domácnosti alebo z práce. Potom si ju prečítaj nahlas: ak znie nejasne, upresni pojmy. **Častá chyba** je spoľahnúť sa na prvý dojem bez kontroly, či percento alebo pravdepodobnosť patrí k správnemu základu. Ak si nevieš rady, vráť sa k zneniu otázky v teste a porovnaj ho so správnou odpoveďou.',
    '**Praktický krok:** Vezmi si papier alebo poznámku v telefóne a rozpíš výpočet po jednom kroku — aj keď ti neskôr pôjde „naspamäť“, spočiatku ťa to ochráni pred chybami pri úpravách. Skús si tiež vymyslieť protipríklad: kedy by podobné tvrdenie neplatilo? Tak lepšie pochopíš hranice pravidla a nebudeš ho používať slepo mimo kontextu.',
    '**Učenie do hĺbky:** Po prečítaní si na 30 sekúnd zavri oči a zrekapituluj tri kľúčové slová z textu. Ak si na niektoré nespomenie, prečítaj odsek ešte raz a zvýrazni si ho. **Metóda „vysvetli inému“** funguje aj v tichosti: predstav si, že vysvetľuješ kamarátovi, ktorý tému nevidel — odhalíš diery v chápaní skôr, než príde záverečný test.',
    '**Spojenie s realitou:** Premysli si situáciu za posledný týždeň, kde sa podobná logika mohla hodiť, a zapíš jednu vetu, čo by si urobil inak s novými vedomosťami. Pri číslach si vždy over jednotky a to, či percento počítajú z celej sumy alebo z už zníženej. Takto sa vyhneš chybám, ktoré sú v reklame aj v správach zámerne matúce.',
    '**Kontrola pochopenia:** Prever si pravidlo jednoduchou skúškou: „Platí to vždy, alebo len za istých podmienok?“ Ak nájdeš výnimku, dopíš ju do poznámky — presne tam býva zdroj omylu v testoch. Krátke opakovanie zajtra, hoci len pár minút, výrazne posilní pamäť oproti jednorazovému čítaniu.',
    '**Bezpečnosť a zdravý rozum:** Pri odporúčaniach týkajúcich sa zdravia, financií alebo IT platí: ak niečo znie príliš jednoducho alebo naliehavo, spomaľ. Spoj si fakt s dôveryhodným zdrojom alebo s pravidlom, ktoré si práve precvičil. V učení platí, že spoľahlivosť je dôležitejšia ako rýchlosť — lepšie pomalšie a presne ako rýchlo a skreslene.',
    '**Štruktúra odpovede:** Keď si spätne prechádzaš chybu, rozdeľ si ju na „čo presne som zle interpretoval“ a „aký krok výpočtu alebo logiky som vynechal“. Tým sa nenaučíš len správnu voľbu A/B, ale aj postup, ktorý zopakuješ pri podobných úlohách. Pri dlhších témach si pomôž krátkym zoznamom bodov na konci dňa.',
    '**Odolnosť voči omylom:** **Ľudský** mozog má rád skratky; preto si pri náročnejších témach vyhraď pár minút na „pomalé myslenie“. Prepni telefón do režimu bez upozornení, prečítaj odsek znova a skús ho parafrázovať vlastnými slovami. Ak parafráza nesedí s originálom, ešte nechápeš — to je signál na ďalšie čítanie, nie na preskakovanie.',
    '**Prepojenie pojmov:** Hľadaj medzi dvoma pojmami z textu jednu vetu, ktorá ich spája príčinou a následkom. Tak sa učíš sieťové myslenie namiesto izolovaných definícií. V každodennom živote si potom vieš rýchlejšie vybrať, ktoré pravidlo použiť, lebo vidíš kontext, nie len heslo z učebnice.',
    '**Merateľná skúška:** Ak sa dá, over si výsledok spätným výpočtom alebo inou metódou — napríklad iným vzorcom, ktorý vedie k tomu istému. Pri pravdepodobnosti si nakresli strom možností alebo vypíš všetky výsledky, ak ich nie je veľa. Pri percentách si zvoľ konkrétne čísla a prepočítaj ich ručne aspoň raz, kým si vytvoríš návyk.',
    '**Motivácia a dôsledky:** Zamysli sa, prečo by ťa mohlo zaujímať práve toto pravidlo v budúcnosti — úspora peňazí, lepší spánok, menšie riziko podvodu alebo istota pri skúške. Keď vidíš zmysel, pamäť pracuje ochotnejšie. Krátky zápis „prečo mi to pomôže“ na konci sekcie často stačí na to, aby si sa k látke vrátil aj o týždeň.',
    '**Zhrnutie v jednej vete:** Skús na záver sekcie napísať jednu vetu, ktorá obsahuje hlavný pojem a jeho dôsledok bez nových informácií. Ak sa ti to nepodarí, prečítaj odsek ešte raz. Táto disciplína zvyšuje kvalitu učenia viac než pasívne podčiarkovanie, ktoré často len vyzerá ako pokrok.'
];

function pickAddon(salt) {
    return LEARNING_ADDONS[addonHash(String(salt)) % LEARNING_ADDONS.length];
}

function ensureLearningLength(text, salt) {
    let t = String(text || '').trim();
    let guard = 0;
    while (wordCount(t) < 50 && guard < 3) {
        t = `${t}\n\n${pickAddon(`${salt}-${guard}`)}`;
        guard++;
    }
    return t;
}

function enrichLearningDoc(topicId, byQuestionId, allCorrectSections) {
    const by = {};
    for (const [qid, block] of Object.entries(byQuestionId)) {
        by[qid] = {
            heading: block.heading,
            content: ensureLearningLength(block.content, `${topicId}-${qid}`)
        };
    }
    const ok = allCorrectSections.map((block, i) => ({
        heading: block.heading,
        content: ensureLearningLength(block.content, `${topicId}-ok-${i}`)
    }));
    return { by, ok };
}

function writeTopic(tid, byQuestionId, allCorrectSections, finalTest) {
    const { by, ok } = enrichLearningDoc(tid, byQuestionId, allCorrectSections);
    const doc = { topicId: tid, byQuestionId: by, allCorrectSections: ok, finalTest };
    fs.writeFileSync(path.join(preDir, `topic-${tid}.json`), JSON.stringify(doc, null, 2) + '\n', 'utf8');
}

const L = (heading, content) => ({ heading, content });

const topics = [];

// --- 3 Percentá ---
const pre3 = [
    pq(3, 1, 'Tričko stojí 80 €, zľava 25 %. Koľko zaplatíš?', ['40 €', '60 €', '70 €', '55 €'], 1),
    pq(3, 2, 'Koľko je 15 % z 200?', ['20', '25', '30', '35'], 2),
    pq(3, 3, 'Na tovar za 100 € najprv 20 % zľava, potom 10 % z už zníženej ceny. Koľko zaplatíš?', ['70 €', '72 €', '75 €', '68 €'], 1),
    pq(3, 4, 'Koľko percent je 15 zo 60?', ['20 %', '25 %', '30 %', '35 %'], 1),
    pq(3, 5, 'Cena 50 € sa zvýši o 20 %. Aká je nová cena?', ['60 €', '65 €', '70 €', '55 €'], 0),
    pq(3, 6, 'Ak cenu znížime o 50 % a potom zvýšime o 50 %, vrátime sa na pôvodnú cenu.', ['Pravda', 'Nepravda'], 1, 'true_false'),
    pq(3, 7, 'Koľko je 5 % z 400?', ['15', '20', '25', '30'], 1),
    pq(3, 8, 'Dve zľavy po 10 % za sebou na rovnakú cenu sú presne ako jedna zľava 20 %.', ['Pravda', 'Nepravda'], 1, 'true_false')
];
const by3 = {
    'q1-pre-topic3': L('Zľava v percentách', '**Zľava 25 %** znamená, že platíš **75 %** pôvodnej ceny: 80 × 0,75 = **60 €**. Použi vzorec **nová = pôvodná × (1 − zľava/100)**. Pri viacerých zľavách si pozri, či sa druhá počíta z už zníženej sumy — v obchodoch to býva častejšie.'),
    'q2-pre-topic3': L('Percentá z čísla', '**x % z A** = (x/100) × A. Pre 15 % z 200: 0,15 × 200 = **30**. Ak výsledok nesedí, skontroluj desatinnú čiarku — 15 % nie je 0,015. Rýchly odhad: 10 % z čísla posunie čiarku o jedno miesto vľavo.'),
    'q3-pre-topic3': L('Postupné zľavy', 'Najprv 20 %: 100 × 0,8 = 80. Potom 10 % z80: 80 × 0,9 = **72 €**. Nie je to súčet 20 % + 10 % = 30 % z pôvodnej, lebo druhé percento má **iný základ**. Násobíš faktory: ×0,8 ×0,9.'),
    'q4-pre-topic3': L('Podiel v percentách', 'Koľko % je a z b? Vzorec **(a/b)×100**. Tu 15/60 = 0,25 → **25 %**. Nezamení čitateľa a menovateľa — „zo60“ znamená 60 v menovateli.'),
    'q5-pre-topic3': L('Zvýšenie o percento', '**Zvýšenie o 20 %** = nová hodnota je **120 %** pôvodnej: 50 × 1,2 = **60 €**. Omyl býva pripočítať „20“ namiesto 20 % zo základu.'),
    'q6-pre-topic3': L('Zníženie a zvýšenie', '100 → −50 % → 50 → +50 % → **75**, nie 100. Percentá sa násobia na **aktuálnu** hodnotu, nie sčítavajú ako nulová zmena. Faktory 0,5 × 1,5 = 0,75.'),
    'q7-pre-topic3': L('Malé percentá', '5 % z 400: 400 × 0,05 = **20**. Pomôcka: 10 % je 40, polovica z toho je 20.'),
    'q8-pre-topic3': L('Dvakrát 10 %', 'Dve zľavy 10 %: 0,9 × 0,9 = 0,81, teda **19 %** celkom, nie 20 %. Rozdiel rastie s väčšími percentami.')
};
const ok3 = [
    L('Percentá v praxi', 'Máš vstupný test bez chýb. Pamätaj: percento na desatinné číslo, násobenie základu, pri viacerých zmenách **násob faktory**. Pri e-shopoch čítaj, či je zľava z pôvodnej alebo už akciovej ceny.'),
    L('Checklist', 'Pred platbou odhadni 10 % a 1 %; ostatné percentá často zložíš z nich.')
];
const ft3 = ft('Záverečný test: percentá', [
    ftq('Koľko zaplatíš za 120 € tovar so zľavou 30 %?', ['74 €', '84 €', '90 €', '96 €'], '84 €', 'Platíš 70 % z 120.'),
    ftq('Koľko je 12 % z 250?', ['25', '30', '35', '40'], '30', '0,12 × 250.'),
    ftq('Cena 200 € sa zvýši o 15 %. Nová cena?', ['215 €', '220 €', '230 €', '240 €'], '230 €', '200 × 1,15.'),
    ftq('45 je koľko percent z 180?', ['20 %', '25 %', '30 %', '35 %'], '25 %', '45/180.'),
    ftq('Na 80 € je 10 % zľava a potom 5 % z už zníženej. Finálna cena?', ['66,4 €', '68 €', '68,4 €', '70 €'], '68,4 €', '80 × 0,9 × 0,95.'),
    ftq('Hodnotu znížim o 40 % a výsledok zvýšim o 40 %. Som späť na štarte?', ['Áno', 'Nie', 'Vždy', 'Len pri 100'], 'Nie', '0,6 × 1,4 ≠ 1.'),
    ftq('Koľko je 2,5 % z 1 000?', ['20', '25', '30', '35'], '25', '0,025 × 1000.'),
    ftq('„Druhá položka −50 %“ pri dvoch rovnako drahých kusoch je zhruba zľava z celku:', ['25 %', '33 %', '40 %', '50 %'], '25 %', 'Priemer cien 100 % a 50 %.')
]);
topics.push({ tid: 3, pre: pre3, by: by3, ok: ok3, ft: ft3 });

// --- 5 Pravdepodobnosť ---
const pre5 = [
    pq(5, 1, 'Pri férovej šeststennej kocke je pravdepodobnosť hodu 6:', ['1/3', '1/6', '1/2', '1/12'], 1),
    pq(5, 2, 'Pravdepodobnosť istej udalosti je:', ['0', '0,5', '1', '2'], 2),
    pq(5, 3, 'Ak pri rulete padlo 5× čierna, ďalší hod musí s väčšou pravdepodobnosťou padnúť červená.', ['Pravda', 'Nepravda'], 1, 'true_false'),
    pq(5, 4, 'Dva nezávislé hody férovou mincou — pravdepodobnosť dvoch lírov:', ['1/2', '1/3', '1/4', '1/8'], 2),
    pq(5, 5, 'Šanca 1 : 500 (jedna „výhra“ na 500 pokusov v tomto pomere) je približne:', ['50 %', '10 %', '0,2 %', '2 %'], 2),
    pq(5, 6, 'Ak sú A a B výlučné a pokrývajú všetko, platí P(A) + P(B) = 1.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(5, 7, '10 výherných lístkov z 1000. P(výhra) =', ['1 %', '10 %', '0,1 %', '5 %'], 0),
    pq(5, 8, 'Pre nezávislé A a B platí P(A a B) = P(A) · P(B).', ['Pravda', 'Nepravda'], 0, 'true_false')
];
const by5 = {
    'q1-pre-topic5': L('Kocka', 'Šesť rovnako pravdepodobných výsledkov → každý má **1/6**. Ak si myslel 1/2, pomýlil si počet výsledkov s „polovicou“.'),
    'q2-pre-topic5': L('Istá udalosť', '**P = 1** znamená, že udalosť nastane určite. **0** je nemožná. Hodnota 1 je maximum v pravdepodobnostnom modeli.'),
    'q3-pre-topic5': L('Gamblerov omyl', 'Pri **nezávislých** pokusoch minulosť nemení pravdepodobnosť ďalšieho hodu. Ruleta nemá pamäť — tvrdenie je **nepravdivé**.'),
    'q4-pre-topic5': L('Dva hody mincou', 'Štyri rovnako pravdepodobné výsledky (HH, HT, TH, TT). Dva líry: **1/4** = 1/2 × 1/2.'),
    'q5-pre-topic5': L('Pomer 1:500', 'Jedna „áno“ z približne 500 pokusov → približne **≈ 0,2 %**, nie desiatky percent. Pozor na formuláciu v reklame.'),
    'q6-pre-topic5': L('Výlučné udalosti', 'Ak sa nemôžu stať súčasne a pokrývajú celý priestor, pravdepodobnosti sa **sčítajú** do 1.'),
    'q7-pre-topic5': L('Podiel', '10/1000 = **0,01 = 1 %**. Ak vyšlo 0,1 %, posunul si desatinnú čiarku.'),
    'q8-pre-topic5': L('Nezávislosť', 'Pravidlo súčinu platí pre **nezávislé** udalosti — „A zároveň B“.')
};
const ok5 = [
    L('Pravdepodobnosť', 'Bez chýb — super. Rovnomerný model, súčet pre výlučné možnosti, súčin pre „a zároveň“ pri nezávislosti.'),
    L('Tip', 'Pri správach si všímaj **základňu** (koľko bolo prípadov celkom).')
];
const ft5 = ft('Záverečný test: pravdepodobnosť', [
    ftq('Párna hodnota na jednej kocke:', ['1/6', '1/3', '1/2', '2/3'], '1/2', 'Tri z šiestich.'),
    ftq('Pravdepodobnosť nemožnej udalosti:', ['0', '0,5', '1', '−1'], '0', 'Definícia.'),
    ftq('Jedno eso z 52 kariet (náhodný ťah):', ['1/52', '4/52', '1/13', '1/4'], '1/13', 'Štyri esá / 52.'),
    ftq('P(A)=0,25 a P(B)=0,4 nezávislé. P(A a B)=', ['0,65', '0,1', '0,16', '0,15'], '0,1', '0,25×0,4.'),
    ftq('Viac prehier v lotérii zvyšuje šancu na výhru v ďalšom nezávislom žrebe.', ['Pravda', 'Nepravda'], 'Nepravda', 'Nezávislé žrebovania.'),
    ftq('1 % je:', ['1/10', '1/100', '1/1000', '10/100'], '1/100', 'Percento.'),
    ftq('3 červené a 7 modrých gúľ — P(červená):', ['3/10', '7/10', '3/7', '1/3'], '3/10', 'Podiel.'),
    ftq('Súčet dvoch kociek je 7 (usporiadané dvojice):', ['5/36', '6/36', '7/36', '1/6'], '6/36', 'Šesť kombinácií.')
]);
topics.push({ tid: 5, pre: pre5, by: by5, ok: ok5, ft: ft5 });

function repeatLearn(tid, prefix) {
    const o = {};
    for (let i = 1; i <= 8; i++) {
        const qid = `q${i}-pre-topic${tid}`;
        o[qid] = L(`${prefix} — otázka ${i}`, `Táto časť dopĺňa tvoje slabšie miesto z vstupného testu. **Kľúčové pojmy** si prepoj s vlastným príkladom: napíš jednu vetu, kde ich použiješ správne. Ak si nebol istý, vráť sa k zneniu otázky a porovnaj so **správnou odpoveďou** v teste — hľadaj rozdiel v logike, nie v memorovaní. Krátke opakovanie zajtra zvýši zapamätanie.`);
    }
    return o;
}

// --- 11 Spánok ---
const pre11 = [
    pq(11, 1, 'Orientačné odporúčanie spánku pre dospelých je často okolo:', ['5–6 h', '7–9 h', '10–12 h', '3–4 h'], 1),
    pq(11, 2, 'Modré svetlo z obrazoviek večer môže:', ['urychliť zaspávanie', 'sťažiť zaspávanie', 'vylúčiť spánok úplne', 'nahradiť denné svetlo'], 1),
    pq(11, 3, 'Kofeín popoludní u ľudí môže zhoršiť nočný spánok.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(11, 4, 'Spánkovú depriváciu sa dá zdravo plne „dospať“ jedným víkendom bez následkov.', ['Pravda', 'Nepravda'], 1, 'true_false'),
    pq(11, 5, 'REM spánok je dôležitý okrem iného pre:', ['rast kostí', 'pamäť a spracovanie emócií', 'trávenie bielkovín', 'hydratáciu'], 1),
    pq(11, 6, 'Pravidelný čas vstávania pomáha:', ['narušiť rytmus', 'stabilizovať biologické hodiny', 'vylúčiť hlboký spánok', 'znížiť potrebu svetla'], 1),
    pq(11, 7, 'Krátke zdriemnutie popoludní (napr. 20 min) môže:', ['vždy zničiť nočný spánok', 'podporiť bdelosť u niektorých', 'nahradiť 8 h spánku', 'vylúčiť REM'], 1),
    pq(11, 8, 'Hlučné prostredie počas spánku často:', ['zvyšuje hlboký spánok', 'sťažuje kvalitu spánku', 'nemá vplyv', 'zvyšuje len sny'], 1)
];
const by11 = {
    'q1-pre-topic11': L('DĹžka spánku', 'Väčšina dospelých potrebuje približne **7–9 h**; individuálne rozdiely sú normálne. Trvalé spánkové dlhy zvyšujú riziko únavy a horšieho výkonu.'),
    'q2-pre-topic11': L('Svetlo', 'Večer **modré svetlo** tlmí prirodzenú prípravu tela na spánok. Tlmenie obrazoviek alebo skoršie stmavenie miestnosti pomáha.'),
    'q3-pre-topic11': L('Kofeín', '**Kofeín** blokuje adenosínové receptory; polčas je hodiny. Popoludňajší nápoj môže u citlivých ľudí oneskoriť zaspávanie.'),
    'q4-pre-topic11': L('Dospávanie', 'Dlhotrvajúci dlh sa **nedá** úplne a zdravo „napraviť“ jedným víkendom; rytmus a kognitívna záťaž trpia.'),
    'q5-pre-topic11': L('REM', '**REM** súvisí s pamäťou a emóciami; hlboký spánok podporuje fyzickú obnovu. Obe fázy sú dôležité.'),
    'q6-pre-topic11': L('Budík', '**Stabilný čas vstávania** posilňuje cirkadiánny rytmus; telo vie, kedy má byť bdelé.'),
    'q7-pre-topic11': L('Power nap', 'Krátke zdriemnutie môže pomôcť bdelosti; načasovanie a dĹžka ovplyvňujú, či ruší večer.'),
    'q8-pre-topic11': L('Hluk', 'Hluk fragmentuje spánok a znižuje podiel hlbokého spánku — **ticho** a **tma** sú ideálne.')
};
const ok11 = [
    L('Spánková hygiena', 'Vstupný test si zvládol výborne. Drž **pravidelnosť**, večer **tlm svetlo**, vyhni sa dlhému ležaniu bdelý v posteli.'),
    L('Kedy na lekára', 'Silné chrápanie, dýchacie pauzy alebo denná spavosť môžu znamenať spánkovú poruchu — oplatí sa konzultácia.')
];
const ft11 = ft('Záverečný test: spánok', [
    ftq('Čo najviac pomáha cirkadiánnemu rytmu?', ['Nepravidelný budík', 'Približne rovnaký čas vstávania', 'Iba večerný šport', 'Spánok bez okna'], 'Približne rovnaký čas vstávania', 'Stabilita.'),
    ftq('Melatonín signalizuje organizmu najmä:', ['Hlad', 'Príchod obdobia spánku', 'Teplotu svalov', 'Trávenie'], 'Príchod obdobia spánku', 'Hormón spánku.'),
    ftq('Alkohol pred spaním často:', ['zlepšuje REM', 'môže narušiť kvalitu spánku', 'nemá vplyv', 'nahradí spánkový dlh'], 'môže narušiť kvalitu spánku', 'Fragmentácia.'),
    ftq('Ideálnejšie prostredie na spanie:', ['jas, hluk', 'tma, ticho, chladnejšia miestnosť', 'teplo a TV', 'nezáleží'], 'tma, ticho, chladnejšia miestnosť', 'Prostredie.'),
    ftq('Chronický nedostatok spánku:', ['ovplyvňuje len náladu', 'môže ovplyvniť zdravie a výkon', 'sa vždy dá okamžite napraviť kávou', 'nemá dlhodobé dôsledky'], 'môže ovplyvniť zdravie a výkon', 'Komplexné účinky.'),
    ftq('Modré svetlo z telefónu večer:', ['vždy pomáha zaspať', 'môže potláčať signály na spánok', 'je totožné so slnkom', 'nemá vplyv na mozog'], 'môže potláčať signály na spánok', 'Melatonín.'),
    ftq('Dlhé zdriemnutie neskoro večer:', ['vždy odporúčané', 'môže niektorým sťažiť nočný spánok', 'nahradí noc', 'zvýši vždy REM'], 'môže niektorým sťažiť nočný spánok', 'Časovanie.'),
    ftq('Hlboký spánok je spojený najmä s:', ['iba snívaním', 'fyzickou obnovou', 'iba REM', 'kofeínom'], 'fyzickou obnovou', 'NREM hlboký.')
]);
topics.push({ tid: 11, pre: pre11, by: by11, ok: ok11, ft: ft11 });

// --- 12 Výživové tabuľky ---
const pre12 = [
    pq(12, 1, 'Energia na etikete v EU sa často uvádza v:', ['kJ a kcal', 'len g', 'litrách', 'pH'], 0),
    pq(12, 2, '„Na 100 g“ znamená hodnoty:', ['vždy pre celý obal', 'pre referenčných 100 g', 'vždy pre jednu porciu', 'iba pre cukor'], 1),
    pq(12, 3, 'Porcia 30 g, obal 150 g — koľko porcií?', ['3', '4', '5', '6'], 2),
    pq(12, 4, 'Celkové cukry v tabuľke môžu zahŕňať pridaný aj prirodzený cukor v jednom výrobku.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(12, 5, 'Vysoký obsah soli môže byť problematický pre krvný tlak u ľudí.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(12, 6, 'Nasýtené mastné kyseliny by sme mali v strave:', ['neobmedzene', 'sledovať a obmedzovať', 'úplne vylúčiť vždy', 'nahradiť len cukrom'], 1),
    pq(12, 7, 'Vláknina pochádza najčastejšie z:', ['čistého mäsa', 'rastlinných zdrojov', 'sladidiel', 'vody'], 1),
    pq(12, 8, '% referenčného príjmu na etikete slúži na:', ['cenu', 'orientáciu voči odporúčanému dennému príjmu', 'trvanlivosť', 'dávku lieku'], 1)
];
const by12 = {
    'q1-pre-topic12': L('Energia', '**kJ a kcal** udávajú energetickú hodnotu — kcal sú pre väčšinu ľudí intuitívnejšie. Porovnávaj výrobky na rovnakej báze (100 g alebo porcia).'),
    'q2-pre-topic12': L('Na 100 g', 'Údaj **na 100 g** umožňuje porovnať výrobky navzájom, aj keď máš inú veľkosť balenia.'),
    'q3-pre-topic12': L('Porcie', '150 / 30 = **5** porcií. Ak zješ celý obal, vynásob hodnoty na porciu piatimi.'),
    'q4-pre-topic12': L('Cukry', '**Celkové cukry** sú súčet; pridaný cukor hľadaj aj v zložení (sirupy, glukóza…).'),
    'q5-pre-topic12': L('Soľ', 'Nadmerná soľ súvisí s **tlakom** u predisponovaných ľudí — Svetová zdravotnícka organizácia odporúča obmedzovať príjem.'),
    'q6-pre-topic12': L('Nasýtené tuky', '**Nasýtené** mastné kyseliny často zvyšujú LDL — obmedzovanie je rozumná súčasť prevencie.'),
    'q7-pre-topic12': L('Vláknina', 'Vláknina je **rastlinný** polysacharid — celozrnné, strukoviny, ovocie a zelenina.'),
    'q8-pre-topic12': L('% RDA', 'Percentá **GDV/RVH** sú orientačné voči referenčnému dennému príjmu dospelého.')
};
const ok12 = [
    L('Etikety', 'Super. Vždy skontroluj **porciu**, **100 g** a **zloženie**.'),
    L('Prax', 'Porovnaj dve podobné cereálie na cukor a vlákninu na 100 g.')
];
const ft12 = ft('Záverečný test: výživové tabuľky', [
    ftq('2 porcie po 40 g, na porciu 200 kcal. Spolu?', ['200', '320', '400', '440'], '400', '2×200.'),
    ftq('„Bez pridaného cukru“ vždy znamená bez kalórií.', ['Pravda', 'Nepravda'], 'Nepravda', 'Môže obsahovať inú energiu.'),
    ftq('Vláknina sa často nachádza v:', ['sladených nápojoch', 'celozrnných výrobkoch', 'čistom mäse bez príloh', 'čokoláde'], 'celozrnných výrobkoch', 'Zdroje.'),
    ftq('Kalórie a zdravie:', ['kalória je jediný ukazovateľ', 'dôležitý je aj typ živín a celkový vzorec stravy', 'nízke kalórie = vždy zdravé', 'vysoké kalórie = vždy zlé'], 'dôležitý je aj typ živín a celkový vzorec stravy', 'Kontext.'),
    ftq('Porcia na obale je:', ['zákon o tom, koľko musíš zjesť', 'orientačná dávka výrobcu', 'vždy 100 g', 'počet v celej krabici'], 'orientačná dávka výrobcu', 'Definícia.'),
    ftq('Nasýtené tuky v tabuľke by si mal:', ['ignorovať', 'sledovať pri častých nákupoch', 'maximalizovať', 'nahradiť trans tukmi'], 'sledovať pri častých nákupoch', 'Srdce.'),
    ftq('Soľ v tabuľke 0,5 g na porciu — pri nízkom celkovom príjme soli:', ['vždy nebezpečné', 'záleží na celkovom dni a individuálnych limitoch', 'vždy zdravé', 'soľ nezáleží'], 'záleží na celkovom dni a individuálnych limitoch', 'Kumulácia.'),
    ftq('Energia z tukov 9 kcal/g, zo sacharidov 4 kcal/g — rovnaká hmotnosť tuku a sacharidov:', ['rovnaká energia', 'tuk má vyššiu energetickú hustotu', 'sacharidy majú vždy viac', 'energia nezávisí od makier'], 'tuk má vyššiu energetickú hustotu', '9 vs 4 kcal/g.')
]);
topics.push({ tid: 12, pre: pre12, by: by12, ok: ok12, ft: ft12 });

// --- 13 Investovanie ---
const pre13 = [
    pq(13, 1, 'Vyšší očakávaný výnos zvyčajne súvisí s:', ['nulovým rizikom', 'vyšším rizikom kolísania', 'žiadnym vzťahom', 'istotou istiny'], 1),
    pq(13, 2, 'Diverzifikácia znamená:', ['všetko v jednej akcii', 'rozloženie medzi viac investícií', 'vyhnúť sa investovaniu', 'iba hotovosť'], 1),
    pq(13, 3, 'Inflácia časom znižuje reálnu kúpnu silu hotovosti.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(13, 4, '„Garantovaný vysoký výnos bez rizika“ je často:', ['štátna ponuka', 'signál opatrnosti', 'typický podvodný návnada', 'normálna banka'], 2),
    pq(13, 5, 'Dlhší investičný horizont často znáša krátkodobú volatilitu.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(13, 6, 'Kúpa akcie znamená:', ['pôžičku firme', 'podiel na vlastníctve', 'pevný úrok', 'poistenie vkladu'], 1),
    pq(13, 7, 'Dlhové nástroje sú vždy v každej situácii bezpečnejšie než akcie.', ['Pravda', 'Nepravda'], 1, 'true_false'),
    pq(13, 8, 'Rovnaká nominálna suma peňazí po rokoch inflácie často:', ['vždy kúpi viac', 'môže reálne kúpiť menej', 'je vždy rovnaká', 'nie je ovplyvnená'], 1)
];
const by13 = {
    'q1-pre-topic13': L('Výnos a riziko', 'Vyšší **potenciálny výnos** typicky prichádza s **väčším kolísaním** — riziko a výnos sú spojené.'),
    'q2-pre-topic13': L('Diverzifikácia', '**Šírenie** investícií znižuje dopad pádu jednej oblasti — neodstraňuje však riziko trhu ako celku.'),
    'q3-pre-topic13': L('Inflácia', '**Inflácia** eroduje reálnu hodnotu hotovosti; dlhodobo držať všetko v hotovosti môže znamenať stratu kúpnej sily.'),
    'q4-pre-topic13': L('Podvody', 'Žiadne legálne trhové investovanie **negarantuje** vysoký výnos bez rizika — buď opatrný.'),
    'q5-pre-topic13': L('Čas', '**Časový horizont** umožňuje „vyrovnať“ krátkodobé výkyvy — nie je to záruka zisku.'),
    'q6-pre-topic13': L('Akcie', '**Akcia** = vlastnícky podiel; zisky a straty závisia od firmy a trhu.'),
    'q7-pre-topic13': L('Dlhopisy', 'Aj **dlhopisy** môžu strácať (úrokové riziko, úverové riziko) — „vždy bezpečnejšie“ je zjednodušenie.'),
    'q8-pre-topic13': L('Reálna hodnota', 'Nominálne euro **nemusí** znamenať rovnakú kúpnu silu po rokoch inflácie.')
};
const ok13 = [
    L('Investičný rámec', 'Máš dobrý základ. Definuj **cieľ**, **horizont** a **rizikovú toleranciu** pred výberom nástrojov.'),
    L('Opatrnosť', 'Overuj **regulovaných** sprostredkovateľov; neinvestuj peňazí, ktoré potrebuješ zajtra.')
];
const ft13 = ft('Záverečný test: investovanie', [
    ftq('Ktoré tvrdenie je najbližšie pravde?', ['Vysoký výnos bez rizika je bežný', 'Riziko a očakávaný výnos súvisia', 'Timing trhu je jednoduchý', 'Jedna akcia stačí'], 'Riziko a očakávaný výnos súvisia', 'Základ.'),
    ftq('ETF často ponúka:', ['koncentráciu do jednej firmy', 'šírku trhu za relatívne nízky poplatok', 'istotu zisku', 'poistenie vkladu'], 'šírku trhu za relatívne nízky poplatok', 'Index.'),
    ftq('Reálna návratnosť zohľadňuje:', ['iba nominál', 'infláciu a poplatky', 'počasie', 'meno brokera'], 'infláciu a poplatky', 'Reálny výnos.'),
    ftq('Emocionálne predávanie pri poklese často:', ['maximalizuje zisk', 'vedie k zlému načasovaniu', 'je vždy správne', 'nemá efekt'], 'vedie k zlému načasovaniu', 'Behaviorálne.'),
    ftq('Diverzifikácia:', ['odstraňuje všetko riziko', 'znižuje koncentráciu rizika', 'zvýši vždy výnos', 'znamená jednu akciu'], 'znižuje koncentráciu rizika', 'Definícia.'),
    ftq('Inflácia 3 % ročne pre hotovosť bez úroku:', ['zvyšuje kúpnu silu', 'časom znižuje reálnu kúpnu silu', 'nemá vplyv', 'platí len pre firmy'], 'časom znižuje reálnu kúpnu silu', 'Peňazí treba viac.'),
    ftq('Dlhopis vydavateľa s vysokým úverovým rizikom:', ['nemá nikdy riziko defaultu', 'môže mať vyšší kupón ale aj vyššie riziko', 'je vždy rovný štátnemu', 'nie je možné stratiť'], 'môže mať vyšší kupón ale aj vyššie riziko', 'Úverové riziko.'),
    ftq('Dlhodobé držanie rozumného diverzifikovaného portfólia:', ['vylučuje straty', 'nezaručuje zisk, ale je rozumná stratégia pre mnohé ciele', 'je nelegálne', 'nahradí zdravý rozpočet'], 'nezaručuje zisk, ale je rozumná stratégia pre mnohé ciele', 'Realita.')
]);
topics.push({ tid: 13, pre: pre13, by: by13, ok: ok13, ft: ft13 });

// --- 14 Bezpečnosť ---
const pre14 = [
    pq(14, 1, 'Silné heslo by malo byť:', ['krátke a všeobecné', 'dlhšie a jedinečné pre službu', 'rovnaké všade', 'dátum narodenia'], 1),
    pq(14, 2, '2FA pridáva:', ['reklamu', 'ďalšiu vrstvu okrem hesla', 'nič', 'verejný profil'], 1),
    pq(14, 3, 'Phishing často žiada okamžite heslo cez podozrivý odkaz.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(14, 4, 'Verejná Wi-Fi bez ochrany je ideálna na bankovníctvo bez obáv.', ['Pravda', 'Nepravda'], 1, 'true_false'),
    pq(14, 5, 'Aktualizácie systému často opravujú bezpečnostné chyby.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(14, 6, 'Zálohy dát pomáhajú aj pri útokoch typu ransomware.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(14, 7, 'Sociálny inžiniering znamená manipuláciu človeka, aby vyzradil údaje.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(14, 8, 'Správca hesiel pomáha používať unikátne heslá.', ['Pravda', 'Nepravda'], 0, 'true_false')
];
const by14 = {
    'q1-pre-topic14': L('Heslo', '**DĹžka a jedinečnosť** — rovnaké heslo na viacerých miestach znamená jednu únikovú udalosť = viac účtov ohrozených.'),
    'q2-pre-topic14': L('2FA', '**Dvojfaktorová autentifikácia** výrazne znižuje riziko úniku hesla z útočníka.'),
    'q3-pre-topic14': L('Phishing', 'Útočník **napodobňuje** dôveryhodnú stránku — overuj **doménu** a neklikaj pod tlakom.'),
    'q4-pre-topic14': L('Wi-Fi', 'Na **verejnej sieti** môže niekto odpočúvať — citlivé operácie rieš cez mobilné dáta alebo VPN.'),
    'q5-pre-topic14': L('Aktualizácie', '**Záplaty** zatvárajú známe diery — odkladanie zvyšuje riziko.'),
    'q6-pre-topic14': L('Zálohy', '**Offline alebo oddelená záloha** môže zachrániť dáta pri šifrovaní útokom.'),
    'q7-pre-topic14': L('Sociálny inžiniering', 'Útočník **klame** alebo budí dôveru — technická ochrana nestačí bez opatrného správania.'),
    'q8-pre-topic14': L('Password manager', 'Generuje a ukladá **unikátne** heslá; master heslo chráň silné.')
};
const ok14 = [
    L('Digitálna hygiena', 'Výborne. **Unikátne heslá + 2FA + opatrnosť pri odkazoch**.'),
    L('Účty', 'Zruš nepoužívané účty, aby sa zmenšila plocha útoku.')
];
const ft14 = ft('Záverečný test: digitálna bezpečnosť', [
    ftq('Podozrivý SMS odkaz na platbu:', ['kliknem', 'overím cez oficiálnu aplikáciu/banku', 'pošlem PIN', 'zdieľam heslo'], 'overím cez oficiálnu aplikáciu/banku', 'Overenie.'),
    ftq('Ransomware typicky:', ['zálohuje dáta zadarmo', 'šifruje dáta a žiada výkupné', 'zrýchľuje PC', 'je antivírus'], 'šifruje dáta a žiada výkupné', 'Typ útoku.'),
    ftq('HTTPS v prehliadači zaručuje:', ['legitímny obsah vždy', 'šifrovaný prenos', 'nulové riziko phishingu', 'iba štát'], 'šifrovaný prenos', 'TLS.'),
    ftq('Leak hesla z inej služby — rovnaké heslo u teba:', ['nevadi', 'zmeň a nepoužívaj rovnaké', 'ignoruj', 'zdieľaj'], 'zmeň a nepoužívaj rovnaké', 'Credential stuffing.'),
    ftq('Phishing hovor „z banky“:', ['poslať PIN', 'overiť číslo a zavolať späť oficiálnou linkou', 'inštalovať soft od volajúceho', 'vždy dôverovať'], 'overiť číslo a zavolať späť oficiálnou linkou', 'Vishing.'),
    ftq('Master heslo správcu hesiel:', ['123456', 'silné, len u teba', 'na nástenke', 'zdieľané'], 'silné, len u teba', 'Kľúč.'),
    ftq('Verejný USB kľúč nájdený na parkovisku:', ['pripojiť hneď', 'nepripájať — riziko malwaru', 'formátovať vždy stačí', 'bezpečné'], 'nepripájať — riziko malwaru', 'USB drop.'),
    ftq('2FA cez SMS je:', ['vždy najsilnejšie', 'lepšie ako nič, ale môže mať slabiny', 'nepoužiteľné', 'nahradí heslo'], 'lepšie ako nič, ale môže mať slabiny', 'SIM swap riziko.')
]);
topics.push({ tid: 14, pre: pre14, by: by14, ok: ok14, ft: ft14 });

// --- 15 Klíma ---
const pre15 = [
    pq(15, 1, 'Skleníkový efekt: niektoré plyny v atmosfére', ['odvádzajú všetko teplo', 'zachytávajú časť vyžarovaného tepla', 'nemajú vplyv', 'chladia planétu bezmedzne'], 1),
    pq(15, 2, 'Počasie vs. klíma:', ['to isté', 'počasie krátkodobé, klíma dlhodobý priemer', 'klíma je jeden deň', 'nedefinovateľné'], 1),
    pq(15, 3, 'CO₂ je skleníkový plyn.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(15, 4, 'Jedna studená zima vyvracia merané dlhodobé otepľovanie.', ['Pravda', 'Nepravda'], 1, 'true_false'),
    pq(15, 5, 'Oceány absorbujú časť CO₂ a ovplyvňujú okysľovanie.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(15, 6, 'Ľudská činnosť zvýšila koncentráciu CO₂ od priemyselnej revolúcie.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(15, 7, '„Vedec nevie počasie na zajtra, tak nevie klímu“ je:', ['logicky správne', 'omyl — iné škály a dôkazy', 'vždy pravda', 'definícia IPCC'], 1),
    pq(15, 8, 'Mitigácia klimatických zmien znamená najmä:', ['ignorovať emisie', 'znižovanie emisií a príčin', 'iba prispôsobenie', 'zákaz výskumu'], 1)
];
const by15 = {
    'q1-pre-topic15': L('Skleníkový efekt', '**Skleníkové plyny** prepúšťajú slnečné žiarenie a zadržiavajú infračervené — bez nich by Zem bola chladnejšia; zvýšením koncentrácie sa posilňuje efekt.'),
    'q2-pre-topic15': L('Počasie a klíma', '**Počasie** = dážď zajtra; **klíma** = štatistika desaťročí — iná časová škála.'),
    'q3-pre-topic15': L('CO₂', '**Oxid uhličitý** je dlhodobo dôležitý antropogénny skleníkový plyn.'),
    'q4-pre-topic15': L('Počasie vs trend', 'Jednotlivé udalosti sú **šum** okolo dlhodobého **trendu** — lokálna zima nevyvracia globálne priemery.'),
    'q5-pre-topic15': L('Oceány', 'Oceán **absorbuje CO₂**, čo mení chemické vlastnosti (okysľovanie) a ovplyvňuje ekosystémy.'),
    'q6-pre-topic15': L('Antropogénne emisie', 'Paleoklimatológia a merania ukazujú **rýchly nárast** CO₂ v industrialnej ére.'),
    'q7-pre-topic15': L('Veda', 'Krátkodobá predpoveď počasia a **dlhodobé klíma** sú rôzne úlohy modelov — analogia je zavádzajúca.'),
    'q8-pre-topic15': L('Mitigácia', '**Mitigácia** = znižovať príčiny (emisie); **adaptácia** = prispôsobiť sa dôsledkom.')
};
const ok15 = [
    L('Fakty', 'Dobrá orientácia. Rozlišuj **merané trendy** od politických debát.'),
    L('Zdroje', 'Súhrny IPCC sú dobrý vstup pre laikov.')
];
const ft15 = ft('Záverečný test: klíma', [
    ftq('Hlavný dlhodobý antropogénny skleníkový plyn v zmysle príspevku k vynútenému otepleniu:', ['Argón', 'CO₂', 'Dusík N2', 'O₂'], 'CO₂', 'IPCC.'),
    ftq('Albedo súvisí s:', ['teplotou jadra', 'odrazivosťou povrchu', 'hmotnosťou Mesiaca', 'slanosti mora'], 'odrazivosťou povrchu', 'Reflexia.'),
    ftq('Oteplenie klimatického systému znamená:', ['každé miesto teplejšie každý deň', 'rast dlhodobého globálneho priemeru teploty', 'žiadna zmena v oceáne', 'iba Arktída'], 'rast dlhodobého globálneho priemeru teploty', 'Globálny priemer.'),
    ftq('Zdroj fosílnych palív uvoľňuje:', ['uhlík viazaný dlhodobo v zemi', 'len vodnú paru bez uhlíka', 'žiadny uhlík', 'iba kyslík'], 'uhlík viazaný dlhodobo v zemi', 'Uhlíkový cyklus.'),
    ftq('pH oceánu klesá pri vstrebávaní CO₂:', ['Pravda', 'Nepravda'], 'Pravda', 'Okysľovanie.'),
    ftq('Proxy záznamy (ľadové jadrá) slúžia na:', ['predpoveď počasia na zajtra', 'odhad minulých koncentrácií a teôt', 'horoskopy', 'iba turistiku'], 'odhad minulých koncentrácií a teplôt', 'Paleoklima.'),
    ftq('Extrémne počasie a zmena klímy:', ['sú totožné', 'extrémy môžu byť modifikované zmenou klímy', 'nemôžu súvisieť', 'klíma neexistuje'], 'extrémy môžu byť modifikované zmenou klímy', 'Attribúcia.'),
    ftq('Net zero cieľ sa týka typicky:', ['iba dopravy', 'bilancie emisií a odstránení v systéme', 'iba elektriny', 'žiadnych emisií u nikoho'], 'bilancie emisií a odstránení v systéme', 'Definícia.')
]);
topics.push({ tid: 15, pre: pre15, by: by15, ok: ok15, ft: ft15 });

// --- 16 Učenie ---
const pre16 = [
    pq(16, 1, 'Spaced repetition znamená opakovanie:', ['iba v jeden deň', 'rozložené v čase', 'nikdy', 'len pasívne čítanie'], 1),
    pq(16, 2, 'Aktívne vyvolávanie z pamäti často posilňuje učenie.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(16, 3, 'Multitasking pri náročnom učení zvyčajne zvyšuje kvalitu.', ['Pravda', 'Nepravda'], 1, 'true_false'),
    pq(16, 4, 'Kratšie bloky s prestávkami môžu pomôcť pozornosti.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(16, 5, 'Spánok po učení môže podporiť konsolidáciu pamäte.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(16, 6, 'Striedanie tém pri cvičení (interleaving) môže pomôcť prenosu.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(16, 7, 'Len podčiarkovanie textu bez aktívnej práce je často slabá stratégia.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(16, 8, 'Metakognícia znamená vedomie o vlastnom učení a stratégiách.', ['Pravda', 'Nepravda'], 0, 'true_false')
];
const by16 = {
    'q1-pre-topic16': L('Spacing', '**Rozložené opakovanie** poráža hromadenie v jeden večer — exponenciálne intervaly sú efektívne.'),
    'q2-pre-topic16': L('Retrieval', '**Testovanie** (vyvolávanie) je učebná metóda, nie len hodnotenie.'),
    'q3-pre-topic16': L('Multitasking', 'Mozog **prepína** — pri náročných úlohách klesá kvalita.'),
    'q4-pre-topic16': L('Prestávky', '**Pomodoro** a podobné režimy bránia vyčerpaniu pozornosti.'),
    'q5-pre-topic16': L('Spánok', 'Konsolidácia pamäte prebieha aj počas **spánku**.'),
    'q6-pre-topic16': L('Interleaving', 'Miešanie typov úloh podporuje **rozpoznávanie** vzorcov.'),
    'q7-pre-topic16': L('Highlight', 'Bez **elaborácie** a testov je zvýrazňovanie ilúzia pokroku.'),
    'q8-pre-topic16': L('Metakognícia', '**Plánuj, sleduj, upravuj** stratégiu — uč sa učiť.')
};
const ok16 = [
    L('Efektívne návyky', 'Skvelé výsledky. Kalendár opakovania + self-testy + spánok.'),
    L('Feynman', 'Vysvetli tému jednoducho — odhalíš diery.')
];
const ft16 = ft('Záverečný test: učenie', [
    ftq('Retrieval practice je:', ['pasívne čítanie', 'aktívne si vybavovanie', 'kopírovanie', 'vyhýbanie sa chybám'], 'aktívne si vybavovanie', 'Definícia.'),
    ftq('Distribuované vs. hromadené opakovanie:', ['hromadené vždy lepšie', 'distribuované často lepšie pre trvanlivosť', 'rovnaké', 'neexistuje výskum'], 'distribuované často lepšie pre trvanlivosť', 'Spacing.'),
    ftq('Desirable difficulties znamenajú:', ['učenie musí byť vždy ľahké', 'primeraná náročnosť môže pomôcť trvalosti', 'žiadne chyby', 'iba rýchlosť'], 'primeraná náročnosť môže pomôcť trvalosti', 'Bjork.'),
    ftq('Dual coding kombinuje:', ['iba zvuk', 'verbálne a vizuálne reprezentácie', 'iba spánok', 'iba highlight'], 'verbálne a vizuálne reprezentácie', 'Mayer/Paivio.'),
    ftq('Chyby pri učení:', ['vždy škodia', 'môžu byť informačné pri oprave', 'treba sa im vyhnúť úplne', 'nahrádzajú spánok'], 'môžu byť informačné pri oprave', 'Errorful learning.'),
    ftq('Plánovanie štúdia:', ['iba motivácia', 'konkrétny čas a ciele zvyšujú dodržiavanie', 'náhoda', 'len v noci'], 'konkrétny čas a ciele zvyšujú dodržiavanie', 'Implementácia.'),
    ftq('Overlearning bez spacing:', ['vždy optimálne', 'môže dať krátkodobú fluency, spacing je kľúčové', 'nahradí spánok', 'nepoužíva sa'], 'môže dať krátkodobú fluency, spacing je kľúčové', 'Nuansy.'),
    ftq('Interleaving pri cvičení:', ['vždy zmätok bez úžitku', 'môže zlepšiť rozlíšenie medzi konceptmi', 'iba pre deti', 'zakázané'], 'môže zlepšiť rozlíšenie medzi konceptmi', 'Rozlíšenie.')
]);
topics.push({ tid: 16, pre: pre16, by: by16, ok: ok16, ft: ft16 });

// --- 17 Prvá pomoc ---
const pre17 = [
    pq(17, 1, 'Dospelý bez dychu/bez reakcie — čo najskôr:', ['čakať', 'privolať 112 a začať KPR podľa školenia', 'podávať vodu', 'masírovať srdce'], 1),
    pq(17, 2, 'Európske tiesňové číslo je:', ['155', '112', '911', '0800'], 1),
    pq(17, 3, 'Pri masívnom krvácaní treba zastaviť krvácanie tlakom.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(17, 4, 'Pri horiacom oblečení na osobe môže „stop, drop, roll“ pomôcť.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(17, 5, 'Šok: nohy mierne vyvýšené môže byť vhodné len ak nehrozí zranenie chrbtice.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(17, 6, 'Heimlich manéver je pri:', ['zástave srdca', 'úplnom upchaní dýchacích ciest pri vedomí', 'krvácaní', 'popálenine'], 1),
    pq(17, 7, 'FAST skratka môže pomôcť zapamätať príznaky mŕtvice.', ['Pravda', 'Nepravda'], 0, 'true_false'),
    pq(17, 8, 'AED môže použiť laik podľa pokynov zariadenia.', ['Pravda', 'Nepravda'], 0, 'true_false')
];
const by17 = {
    'q1-pre-topic17': L('KPR a112', '**Zavolaj pomoc** a začni **KPR** podľa aktuálnych smerníc — rýchlosť záchrany zvyšuje šancu.'),
    'q2-pre-topic17': L('112', '**112** je tiesňová linka v EU — vieš ju použiť aj v cudzine v EÚ.'),
    'q3-pre-topic17': L('Krvácanie', '**Priame tlakové zastavenie** krvácania je priorita pri masívnom krvácaní.'),
    'q4-pre-topic17': L('Oheň na oblečení', '**Zastaviť, spadnúť, kotúľať** môže uhasiť plameň na textíliách.'),
    'q5-pre-topic17': L('Šok', '**Poloha** závisí od stavu — pri podezrení na úraz chrbtice nekmeň nohy náhodne.'),
    'q6-pre-topic17': L('Heimlich', 'Pri **úplnom upchaní** pri vedomí — absolvuj kurz pre správnu techniku.'),
    'q7-pre-topic17': L('FAST', 'Tvár, paže, reč, čas — **rýchla** pomoc pri mŕtvici znižuje následky.'),
    'q8-pre-topic17': L('AED', '**Automatický defibrilátor** ťa vedie hlasom — použi ho, ak je k dispozícii.')
};
const ok17 = [
    L('Kurz prvej pomoci', 'Orientačný test si zvládol. **Certifikovaný kurz** je najlepší ďalší krok.'),
    L('Bezpečnosť', 'Chráň seba — nevdýchuj dym, nechoď do nebezpečenstva bez výcviku.')
];
const ft17 = ft('Záverečný test: prvá pomoc', [
    ftq('Pri silnej alergickej reakcii s dýchavičnosťou:', ['sledovať doma', '112; adrenalín ak predpísané a školené', 'iba čaj', 'šport'], '112; adrenalín ak predpísané a školené', 'Anafylaxia.'),
    ftq('Pri malom rozsahu popálenia prvou pomocou často:', ['masť hneď', 'chladenie čistou vodou podľa školenia', 'olej', 'škrabaním'], 'chladenie čistou vodou podľa školenia', 'Popálenina.'),
    ftq('Pri záchvate:', ['vkladať predmety do úst', 'ochraniť pred úrazom, merať čas', 'držať silno', 'násilne piť'], 'ochraniť pred úrazom, merať čas', 'Epilepsia.'),
    ftq('Pri otvorenej zlomenine s krvácaním:', ['hniezdiť kosť', 'tlaková bandáž, 112', 'ohýbať', 'masírovať zlomeninu'], 'tlaková bandáž, 112', 'Kombinované.'),
    ftq('Laická KPR dospelého u laikov bez výcvika v dýchaní v niektorých smerniciach:', ['vždy ústa-ústa', 'kompresie-only môžu byť odporúčané', 'nepoužívať ruky', 'iba úder'], 'kompresie-only môžu byť odporúčané', 'ERC/AHA laici.'),
    ftq('Pri zásahu vysokým napätím (drôt na zemi):', ['chytiť osobu', 'bezpečnosť vypnutia prúdu, 112', 'voda na osobu', 'ignorovať'], 'bezpečnosť vypnutia prúdu, 112', 'Bezpečnosť.'),
    ftq('Pri omrzlinách:', ['drhnúť snehom', 'postupné šetrné zahriatie pod dohľadom', 'horúca voda hneď', 'prepichovať pľuzgiere'], 'postupné šetrné zahriatie pod dohľadom', 'Omrzliny.'),
    ftq('Pri bolestiach na hrudníku s iradiáciou a potení — podozrenie na infarkt:', ['šoférovať sám', '112, pokoj', 'silný beh', 'ignorovať'], '112, pokoj', 'AKS orientačne.')
]);
topics.push({ tid: 17, pre: pre17, by: by17, ok: ok17, ft: ft17 });

// --- Run ---
fs.mkdirSync(preDir, { recursive: true });
const ptq = JSON.parse(fs.readFileSync(ptqPath, 'utf8'));
for (const t of topics) {
    writeTopic(t.tid, t.by, t.ok, t.ft);
    ptq[String(t.tid)] = t.pre;
}
fs.writeFileSync(ptqPath, JSON.stringify(ptq, null, 2) + '\n', 'utf8');

// topic-7 finalTest (byQuestionId / allCorrectSections sa doplňajú rovnako ako pri ostatných témach)
const p7path = path.join(preDir, 'topic-7-mocniny.json');
const d7 = JSON.parse(fs.readFileSync(p7path, 'utf8'));
const { by: by7, ok: ok7 } = enrichLearningDoc(7, d7.byQuestionId, d7.allCorrectSections);
d7.byQuestionId = by7;
d7.allCorrectSections = ok7;
d7.finalTest = ft('Záverečný test: mocniny', [
    ftq('Koľko je 4 na tretiu?', ['12', '64', '81', '16'], '64', '4×4×4.'),
    ftq('10 na nultá (pre 10) je:', ['0', '1', '10', '100'], '1', 'Definícia a≠0.'),
    ftq('2 na mínus druhá je:', ['−4', '1/4', '4', '0,5'], '1/4', 'Prevrátená hodnota.'),
    ftq('Čo je väčšie: 3 na štvrtú alebo 4 na tretiu?', ['3 na štvrtú (81)', '4 na tretiu (64)', 'rovnaké', 'nedá sa'], '3 na štvrtú (81)', '81 > 64.'),
    ftq('Odmocnina z 36 je:', ['4', '6', '9', '12'], '6', '6²=36.'),
    ftq('(2 na druhú) na tretiu =', ['2 na piatu', '2 na šiestu', '8', '64'], '2 na šiestu', '(2²)³=2⁶.'),
    ftq('Záporné číslo na párny exponent dáva výsledok:', ['vždy záporný', 'vždy nezáporný', 'vždy 0', 'vždy 1'], 'vždy nezáporný', 'Znamienko.'),
    ftq('x na druhú krát x na tretiu =', ['x na piatu', 'x na šiestu', 'x', '2x na piatu'], 'x na piatu', 'Súčet exponentov.')
]);
fs.writeFileSync(p7path, JSON.stringify(d7, null, 2) + '\n', 'utf8');

console.log('OK: topics', topics.map((t) => t.tid).join(', '), '+ topic-7 finalTest + preTestQuestions.json');
