-- ============================================
-- Factfulness - kompletné nastavenie databázy
-- Spusti celý tento súbor v Supabase SQL Editor
-- ============================================

-- Topics
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  estimated_duration INTEGER DEFAULT 10,
  cover_image TEXT
);
ALTER TABLE topics DISABLE ROW LEVEL SECURITY;

-- Pre-test questions
CREATE TABLE IF NOT EXISTS pre_test_questions (
  id TEXT PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  "order" INTEGER NOT NULL
);
ALTER TABLE pre_test_questions DISABLE ROW LEVEL SECURITY;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  topic_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pre_assessment',
  pre_test_answers JSONB,
  pre_test_score NUMERIC,
  generated_content JSONB,
  content_generated_at TIMESTAMPTZ,
  post_test_answers JSONB,
  post_test_score NUMERIC,
  post_test_completed_at TIMESTAMPTZ,
  post_test_time_seconds INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  test_generation_started_at TIMESTAMPTZ,
  test_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Seed topics
-- ============================================
INSERT INTO topics (id, title, category, difficulty, description, long_description, estimated_duration, cover_image) VALUES
(1, 'Základy Bunky', 'Biológia', 'beginner', 'Spoznajte základnú stavebnú jednotku života — bunku', 'Bunka je najmenšia jednotka života. Naučte sa rozdiely medzi prokaryotickými a eukaryotickými bunkami, funkcie organel a stavbu bunkovej membrány.', 10, '/images/topics/cell.jpg'),
(2, 'Pytagorova Veta', 'Matematika', 'intermediate', 'Pochopte jeden z najdôležitejších vzorcov geometrie', 'Pytagorova veta je základný princíp v geometrii, ktorý popisuje vzťah medzi stranami pravouhlého trojuholníka.', 10, '/images/topics/pythagoras.jpg'),
(3, 'Percentá a zľavy v obchode', 'Životné zručnosti', 'beginner', 'Zľavy, DPH a reálna cena — aby ste vedeli, čo platíte', 'Naučte sa počítať percentá pri zľavách, postupné zľavy a orientovať sa v cenách ako spotrebiteľ.', 10, '/images/topics/pythagoras.jpg'),
(5, 'Pravdepodobnosť v každodennom živote', 'Matematika', 'beginner', 'Šance, kocka a časté omyly pri náhodných javoch', 'Pochopte základy pravdepodobnosti, nezávislé udalosti a prečo minulosť nemení férovú kocku.', 10, '/images/topics/exponents.jpg'),
(6, 'Čo sú to Vektory', 'Matematika', 'intermediate', 'Základy vektorov - veličiny s veľkosťou a smerom', 'Vektory sú matematické objekty s veľkosťou a smerom, používané vo fyzike, grafike a inžinierstve.', 10, '/images/topics/vectors.jpg'),
(7, 'Mocniny a Odmocniny', 'Matematika', 'beginner', 'Pochopte základné pravidlá práce s mocninami', 'Naučte sa, čo sú mocniny, ako ich počítať a kde sa používajú v praxi.', 10, '/images/topics/exponents.jpg'),
(8, 'Stretching Svalov', 'Fitness', 'beginner', 'Naučte sa správne techniky naťahovania pre lepšiu flexibilitu', 'Objavte, ako sa správne stretchovať pre zvýšenie flexibility, prevenciu zranení a lepší výkon.', 10, '/images/topics/stretching.jpg'),
(10, 'List vs Set vs Map', 'Programovanie', 'intermediate', 'Porozumejte dátovým štruktúram v programovaní', 'Naučte sa rozdiely medzi List, Set, Map a Vector - kedy použiť ktorú dátovú štruktúru.', 10, '/images/topics/data-structures.jpg'),
(11, 'Zdravý spánok (základy)', 'Zdravie', 'beginner', 'Rytmus, svetlo a návyky pre lepší oddych', 'Základy spánkovej hygieny, vplyv svetla a kofeínu a prečo má zmysel stabilný čas budíka.', 10, '/images/topics/stretching.jpg'),
(12, 'Ako čítať výživové tabuľky', 'Výživa', 'beginner', 'Energia, cukry, soľ a porcie na obale', 'Naučte sa čítať etikety potravín, porovnávať výrobky a nenechať sa zmiasť marketingom.', 10, '/images/topics/calories.jpg'),
(13, 'Základy investovania: riziko vs. výnos', 'Financie', 'beginner', 'Čo znamená riziko, diverzifikácia a inflácia', 'Orientujte sa v základných pojmoch investovania bez sľubov „bez rizika“ a pochopte časový horizont.', 10, '/images/topics/data-structures.jpg'),
(14, 'Digitálna bezpečnosť pre bežného človeka', 'Technológie', 'beginner', 'Heslá, 2FA a obrana proti phishingu', 'Praktické kroky na ochranu účtov, dát a súkromia v digitálnom svete.', 10, '/images/topics/data-structures.jpg'),
(15, 'Klimatické zmeny: fakty a zjednodušenia', 'Veda', 'beginner', 'Skleníkový efekt, klíma vs. počasie a čo vieme meraním', 'Rozlíšte základné fyzikálne fakty od zjednodušení a pochopte rozdiel medzi počasím a klímou.', 10, '/images/topics/cell.jpg'),
(16, 'Efektívne učenie', 'Vzdelávanie', 'beginner', 'Spaced repetition, testovanie a sústredenie', 'Ako sa učiť múdrejšie: rozloženie opakovania, aktívne vyvolávanie a úlohy jedna po druhej.', 10, '/images/topics/color-theory.jpg'),
(17, 'Základy prvej pomoci (orientačne)', 'Zdravie', 'beginner', 'Tiesňové číslo, KPR a kedy volať pomoc', 'Orientačné pravidlá prvej pomoci — nie náhrada certifikovaného kurzu. Kedy volať 112 a ako neškodiť.', 10, '/images/topics/stretching.jpg')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  difficulty = EXCLUDED.difficulty,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  estimated_duration = EXCLUDED.estimated_duration,
  cover_image = EXCLUDED.cover_image;

-- ============================================
-- Seed pre-test questions
-- ============================================
INSERT INTO pre_test_questions (id, topic_id, question_text, question_type, options, correct_answer, "order") VALUES
('q1-pre-topic1',1,'Čo je bunka?','multiple_choice','["Najmenšia jednotka života","Súbor orgánov","Typ molekuly","Druh tkaniva"]',0,1),
('q2-pre-topic1',1,'Aký je rozdiel medzi prokaryotickou a eukaryotickou bunkou?','multiple_choice','["Prokaryotická bunka nemá jadro, eukaryotická má","Prokaryotická bunka je väčšia","Eukaryotická bunka nemá membránu","Prokaryotická bunka má mitochondrie"]',0,2),
('q3-pre-topic1',1,'Ktoré organizmy majú prokaryotické bunky?','multiple_choice','["Baktérie","Rastliny","Živočíchy","Huby"]',0,3),
('q4-pre-topic1',1,'Akú funkciu má jadro?','multiple_choice','["Riadi život bunky a obsahuje DNA","Ukladá tuk","Produkuje enzýmy pre trávenie","Chráni pred vonkajšími vplyvmi"]',0,4),
('q5-pre-topic1',1,'Prečo sa mitochondria nazýva elektráreň bunky?','multiple_choice','["Pretože produkuje energiu vo forme ATP","Pretože ukladá tuk","Pretože riadi bunku","Pretože obsahuje genetický materiál"]',0,5),
('q6-pre-topic1',1,'Čo robia ribozómy?','multiple_choice','["Syntetizujú bielkoviny","Ukladajú energiu","Riadia bunku","Chránia bunku pred infekciou"]',0,6),
('q7-pre-topic1',1,'Ktoré štruktúry má navyše rastlinná bunka oproti živočíšnej?','multiple_choice','["Bunková stena, chloroplasty, vakuola","Mitochondrie","Ribozómy","Jadro"]',0,7),
('q8-pre-topic1',1,'Akú funkciu má bunková membrána?','multiple_choice','["Reguluje vstup a výstup látok","Produkuje energiu","Syntetizuje bielkoviny","Chráni pred UV žiarením"]',0,8),
('q1-pre-topic2',2,'Pre aký typ trojuholníka platí Pytagorova veta?','multiple_choice','["Pravouhlý trojuholník","Rovnoramenný trojuholník","Rovnostranný trojuholník","Akýkoľvek trojuholník"]',0,1),
('q2-pre-topic2',2,'Ako znie vzorec Pytagorovej vety?','multiple_choice','["a² + b² = c²","a + b = c","a² - b² = c²","a² + b² = 2c²"]',0,2),
('q3-pre-topic2',2,'Čo je prepona?','multiple_choice','["Strana proti pravému uhlu","Strana vedľa pravého uhlu","Kratšia strana trojuholníka","Obvod trojuholníka"]',0,3),
('q4-pre-topic2',2,'Čo sú odvesny?','multiple_choice','["Dve kratšie strany pravouhlého trojuholníka","Najdlhšia strana trojuholníka","Uhol v trojuholníku","Priesečníky výšok"]',0,4),
('q5-pre-topic2',2,'Čo sú Pytagorejské trojuholníky?','multiple_choice','["Pravouhlé trojuholníky s celými stranami","Rovnoramenné trojuholníky","Rovnostranné trojuholníky","Trojuholníky bez pravého uhla"]',0,5),
('q6-pre-topic2',2,'Dá sa Pytagorova veta použiť aj na výpočet odvesny?','multiple_choice','["Áno, b = sqrt(c² - a²)","Nie, len na preponu","Áno, ale len pri rovnostrannom trojuholníku","Nie, len pri rovnoramennom trojuholníku"]',0,6),
('q7-pre-topic2',2,'Vieme pomocou Pytagorovej vety zistiť, či je trojuholník pravouhlý?','multiple_choice','["Áno, ak a² + b² = c²","Nie, treba merať uhly","Áno, ale len pri rovnostrannom trojuholníku","Nie, len pre kvadratické tvary"]',0,7),
('q8-pre-topic2',2,'Prečo Pytagorova veta neplatí pre ľubovoľný trojuholník?','multiple_choice','["Pretože platí iba pre pravouhlý trojuholník","Pretože platí len pre rovnostranné trojuholníky","Pretože platí iba pri rovnoramennom trojuholníku","Pretože platí pre všetky trojuholníky"]',0,8),
('q1-pre-topic3',3,'Tričko stojí 80 €, zľava 25 %. Koľko zaplatíš?','multiple_choice','["40 €","60 €","70 €","55 €"]',1,1),
('q2-pre-topic3',3,'Koľko je 15 % z 200?','multiple_choice','["20","25","30","35"]',2,2),
('q3-pre-topic3',3,'Na tovar za 100 € najprv 20 % zľava, potom 10 % z už zníženej ceny. Koľko zaplatíš?','multiple_choice','["70 €","72 €","75 €","68 €"]',1,3),
('q4-pre-topic3',3,'Koľko percent je 15 zo 60?','multiple_choice','["20 %","25 %","30 %","35 %"]',1,4),
('q5-pre-topic3',3,'Cena 50 € sa zvýši o 20 %. Aká je nová cena?','multiple_choice','["60 €","65 €","70 €","55 €"]',0,5),
('q6-pre-topic3',3,'Ak cenu znížime o 50 % a potom zvýšime o 50 %, vrátime sa na pôvodnú cenu.','true_false','["Pravda","Nepravda"]',1,6),
('q7-pre-topic3',3,'Koľko je 5 % z 400?','multiple_choice','["15","20","25","30"]',1,7),
('q8-pre-topic3',3,'Dve zľavy po 10 % za sebou na rovnakú cenu sú presne ako jedna zľava 20 %.','true_false','["Pravda","Nepravda"]',1,8),
('q1-pre-topic5',5,'Pri férovej šeststennej kocke je pravdepodobnosť hodu 6:','multiple_choice','["1/3","1/6","1/2","1/12"]',1,1),
('q2-pre-topic5',5,'Pravdepodobnosť istej udalosti je:','multiple_choice','["0","0,5","1","2"]',2,2),
('q3-pre-topic5',5,'Ak pri rulete padlo 5× čierna, ďalší hod musí s väčšou pravdepodobnosťou padnúť červená.','true_false','["Pravda","Nepravda"]',1,3),
('q4-pre-topic5',5,'Dva nezávislé hody férovou mincou — pravdepodobnosť dvoch lírov:','multiple_choice','["1/2","1/3","1/4","1/8"]',2,4),
('q5-pre-topic5',5,'Šanca 1 : 500 (jedna „výhra“ na 500 pokusov v tomto pomere) je približne:','multiple_choice','["50 %","10 %","0,2 %","2 %"]',2,5),
('q6-pre-topic5',5,'Ak sú A a B výlučné a pokrývajú všetko, platí P(A) + P(B) = 1.','true_false','["Pravda","Nepravda"]',0,6),
('q7-pre-topic5',5,'10 výherných lístkov z 1000. P(výhra) =','multiple_choice','["1 %","10 %","0,1 %","5 %"]',0,7),
('q8-pre-topic5',5,'Pre nezávislé A a B platí P(A a B) = P(A) · P(B).','true_false','["Pravda","Nepravda"]',0,8),
('q1-pre-topic6',6,'Čo je vektor?','multiple_choice','["Číslo","Veličina s veľkosťou a smerom","Geometrický útvar","Typ rovnice"]',1,1),
('q2-pre-topic6',6,'Ktorá z týchto veličín je vektor?','multiple_choice','["Teplota","Hmotnosť","Rýchlosť","Čas"]',2,2),
('q3-pre-topic6',6,'Skalár má len veľkosť, nie smer.','true_false','["Pravda","Nepravda"]',0,3),
('q4-pre-topic6',6,'Ako sa zapisuje vektor?','multiple_choice','["S šípkou nad písmenom alebo tučným písmom","V zátvorkách","S bodkou","Kurzívou"]',0,4),
('q5-pre-topic6',6,'Čo je nulový vektor?','multiple_choice','["Vektor s veľkosťou 1","Vektor s veľkosťou 0","Vektor v smere osi x","Neexistuje"]',1,5),
('q6-pre-topic6',6,'Vektory sa môžu sčítavať geometricky.','true_false','["Pravda","Nepravda"]',0,6),
('q7-pre-topic6',6,'Ako sa nazýva dĺžka vektora?','multiple_choice','["Smer","Modul alebo veľkosť","Súradnica","Pozícia"]',1,7),
('q8-pre-topic6',6,'V koľkých rozmeroch môže existovať vektor?','multiple_choice','["Len v 2D","Len v 3D","V 2D, 3D aj viacrozmerných priestoroch","Len v 1D"]',2,8),
('q1-pre-topic7',7,'Čo je mocnina?','multiple_choice','["Násobenie dvoch čísel","Opakované násobenie rovnakého čísla","Sčítanie čísel","Delenie čísel"]',1,1),
('q2-pre-topic7',7,'Čo znamená 2³?','multiple_choice','["2 + 3","2 × 3","2 × 2 × 2","3 × 3"]',2,2),
('q3-pre-topic7',7,'Akékoľvek číslo na 0-tú mocninu je 1.','true_false','["Pravda","Nepravda"]',0,3),
('q4-pre-topic7',7,'Koľko je 5²?','multiple_choice','["10","15","25","50"]',2,4),
('q5-pre-topic7',7,'Čo je základ v mocnine 3⁴?','multiple_choice','["3","4","7","12"]',0,5),
('q6-pre-topic7',7,'Mocnina s negatívnym exponentom je vždy záporná.','true_false','["Pravda","Nepravda"]',1,6),
('q7-pre-topic7',7,'Ako sa nazýva číslo n v zápise aⁿ?','multiple_choice','["Základ","Exponent alebo mocniteľ","Výsledok","Koeficient"]',1,7),
('q8-pre-topic7',7,'Čo je druhá mocnina?','multiple_choice','["Násobenie číslom 2","Delenie číslom 2","Násobenie čísla samo sebou","Sčítanie čísla 2-krát"]',2,8),
('q1-pre-topic8',8,'Čo je stretching?','multiple_choice','["Typ kardio cvičenia","Naťahovanie svalov","Silový tréning","Typ stravy"]',1,1),
('q2-pre-topic8',8,'Kedy je najlepší čas na statický stretching?','multiple_choice','["Pred cvičením","Počas cvičenia","Po cvičení","Kedykoľvek"]',2,2),
('q3-pre-topic8',8,'Dynamický stretching je vhodný pred tréningom.','true_false','["Pravda","Nepravda"]',0,3),
('q4-pre-topic8',8,'Ako dlho by mal trvať statický stretch?','multiple_choice','["5-10 sekúnd","15-30 sekúnd","1-2 minúty","5 minút"]',1,4),
('q5-pre-topic8',8,'Čo je dynamický stretching?','multiple_choice','["Držanie pozície bez pohybu","Kontrolované pohyby cez celý rozsah pohybu","Rýchle trhavé pohyby","Pasívne naťahovanie"]',1,5),
('q6-pre-topic8',8,'Stretching by mal byť bolestivý, aby bol efektívny.','true_false','["Pravda","Nepravda"]',1,6),
('q7-pre-topic8',8,'Aký je hlavný benefit stretchingu?','multiple_choice','["Budovanie svalov","Spaľovanie kalórií","Zvýšenie flexibility a rozsahu pohybu","Zvýšenie sily"]',2,7),
('q8-pre-topic8',8,'Čo je ballistický stretching?','multiple_choice','["Pomalé kontrolované naťahovanie","Trhavé odrazové pohyby","Držanie pozície","Pasívny stretching"]',1,8),
('q1-pre-topic10',10,'Čo je List (zoznam)?','multiple_choice','["Usporiadaná kolekcia, ktorá povoľuje duplikáty","Neusporiadaná kolekcia bez duplikátov","Kolekcia párov kľúč-hodnota","Dynamické pole s fixnou veľkosťou"]',0,1),
('q2-pre-topic10',10,'Čo je Set (množina)?','multiple_choice','["Usporiadaná kolekcia s duplikátmi","Neusporiadaná kolekcia bez duplikátov","Párová štruktúra","Pole objektov"]',1,2),
('q3-pre-topic10',10,'Set automaticky odstráni duplicitné prvky.','true_false','["Pravda","Nepravda"]',0,3),
('q4-pre-topic10',10,'Čo je Map (mapa)?','multiple_choice','["Zoznam čísel","Kolekcia párov kľúč-hodnota","Množina prvkov","Statické pole"]',1,4),
('q5-pre-topic10',10,'Ktorá štruktúra je najrýchlejšia na prístup podľa indexu?','multiple_choice','["List","Set","Map","Všetky rovnako"]',0,5),
('q6-pre-topic10',10,'Map môže mať duplicitné kľúče.','true_false','["Pravda","Nepravda"]',1,6),
('q7-pre-topic10',10,'Kedy použiť Set namiesto List?','multiple_choice','["Keď potrebujete zachovať poradie","Keď chcete unikátne prvky a rýchle vyhľadávanie","Keď potrebujete páry kľúč-hodnota","Nikdy"]',1,7),
('q8-pre-topic10',10,'Čo je Vector v programovaní?','multiple_choice','["Matematický vektor","Dynamické pole (ako ArrayList)","Fixné pole","Typ grafu"]',1,8),
('q1-pre-topic11',11,'Orientačné odporúčanie spánku pre dospelých je často okolo:','multiple_choice','["5–6 h","7–9 h","10–12 h","3–4 h"]',1,1),
('q2-pre-topic11',11,'Modré svetlo z obrazoviek večer môže:','multiple_choice','["urychliť zaspávanie","sťažiť zaspávanie","vylúčiť spánok úplne","nahradiť denné svetlo"]',1,2),
('q3-pre-topic11',11,'Kofeín popoludní u ľudí môže zhoršiť nočný spánok.','true_false','["Pravda","Nepravda"]',0,3),
('q4-pre-topic11',11,'Spánkovú depriváciu sa dá zdravo plne „dospať“ jedným víkendom bez následkov.','true_false','["Pravda","Nepravda"]',1,4),
('q5-pre-topic11',11,'REM spánok je dôležitý okrem iného pre:','multiple_choice','["rast kostí","pamäť a spracovanie emócií","trávenie bielkovín","hydratáciu"]',1,5),
('q6-pre-topic11',11,'Pravidelný čas vstávania pomáha:','multiple_choice','["narušiť rytmus","stabilizovať biologické hodiny","vylúčiť hlboký spánok","znížiť potrebu svetla"]',1,6),
('q7-pre-topic11',11,'Krátke zdriemnutie popoludní (napr. 20 min) môže:','multiple_choice','["vždy zničiť nočný spánok","podporiť bdelosť u niektorých","nahradiť 8 h spánku","vylúčiť REM"]',1,7),
('q8-pre-topic11',11,'Hlučné prostredie počas spánku často:','multiple_choice','["zvyšuje hlboký spánok","sťažuje kvalitu spánku","nemá vplyv","zvyšuje len sny"]',1,8),
('q1-pre-topic12',12,'Energia na etikete v EU sa často uvádza v:','multiple_choice','["kJ a kcal","len g","litrách","pH"]',0,1),
('q2-pre-topic12',12,'„Na 100 g“ znamená hodnoty:','multiple_choice','["vždy pre celý obal","pre referenčných 100 g","vždy pre jednu porciu","iba pre cukor"]',1,2),
('q3-pre-topic12',12,'Porcia 30 g, obal 150 g — koľko porcií?','multiple_choice','["3","4","5","6"]',2,3),
('q4-pre-topic12',12,'Celkové cukry v tabuľke môžu zahŕňať pridaný aj prirodzený cukor v jednom výrobku.','true_false','["Pravda","Nepravda"]',0,4),
('q5-pre-topic12',12,'Vysoký obsah soli môže byť problematický pre krvný tlak u ľudí.','true_false','["Pravda","Nepravda"]',0,5),
('q6-pre-topic12',12,'Nasýtené mastné kyseliny by sme mali v strave:','multiple_choice','["neobmedzene","sledovať a obmedzovať","úplne vylúčiť vždy","nahradiť len cukrom"]',1,6),
('q7-pre-topic12',12,'Vláknina pochádza najčastejšie z:','multiple_choice','["čistého mäsa","rastlinných zdrojov","sladidiel","vody"]',1,7),
('q8-pre-topic12',12,'% referenčného príjmu na etikete slúži na:','multiple_choice','["cenu","orientáciu voči odporúčanému dennému príjmu","trvanlivosť","dávku lieku"]',1,8),
('q1-pre-topic13',13,'Vyšší očakávaný výnos zvyčajne súvisí s:','multiple_choice','["nulovým rizikom","vyšším rizikom kolísania","žiadnym vzťahom","istotou istiny"]',1,1),
('q2-pre-topic13',13,'Diverzifikácia znamená:','multiple_choice','["všetko v jednej akcii","rozloženie medzi viac investícií","vyhnúť sa investovaniu","iba hotovosť"]',1,2),
('q3-pre-topic13',13,'Inflácia časom znižuje reálnu kúpnu silu hotovosti.','true_false','["Pravda","Nepravda"]',0,3),
('q4-pre-topic13',13,'„Garantovaný vysoký výnos bez rizika“ je často:','multiple_choice','["štátna ponuka","signál opatrnosti","typický podvodný návnada","normálna banka"]',2,4),
('q5-pre-topic13',13,'Dlhší investičný horizont často znáša krátkodobú volatilitu.','true_false','["Pravda","Nepravda"]',0,5),
('q6-pre-topic13',13,'Kúpa akcie znamená:','multiple_choice','["pôžičku firme","podiel na vlastníctve","pevný úrok","poistenie vkladu"]',1,6),
('q7-pre-topic13',13,'Dlhové nástroje sú vždy v každej situácii bezpečnejšie než akcie.','true_false','["Pravda","Nepravda"]',1,7),
('q8-pre-topic13',13,'Rovnaká nominálna suma peňazí po rokoch inflácie často:','multiple_choice','["vždy kúpi viac","môže reálne kúpiť menej","je vždy rovnaká","nie je ovplyvnená"]',1,8),
('q1-pre-topic14',14,'Silné heslo by malo byť:','multiple_choice','["krátke a všeobecné","dlhšie a jedinečné pre službu","rovnaké všade","dátum narodenia"]',1,1),
('q2-pre-topic14',14,'2FA pridáva:','multiple_choice','["reklamu","ďalšiu vrstvu okrem hesla","nič","verejný profil"]',1,2),
('q3-pre-topic14',14,'Phishing často žiada okamžite heslo cez podozrivý odkaz.','true_false','["Pravda","Nepravda"]',0,3),
('q4-pre-topic14',14,'Verejná Wi-Fi bez ochrany je ideálna na bankovníctvo bez obáv.','true_false','["Pravda","Nepravda"]',1,4),
('q5-pre-topic14',14,'Aktualizácie systému často opravujú bezpečnostné chyby.','true_false','["Pravda","Nepravda"]',0,5),
('q6-pre-topic14',14,'Zálohy dát pomáhajú aj pri útokoch typu ransomware.','true_false','["Pravda","Nepravda"]',0,6),
('q7-pre-topic14',14,'Sociálny inžiniering znamená manipuláciu človeka, aby vyzradil údaje.','true_false','["Pravda","Nepravda"]',0,7),
('q8-pre-topic14',14,'Správca hesiel pomáha používať unikátne heslá.','true_false','["Pravda","Nepravda"]',0,8),
('q1-pre-topic15',15,'Skleníkový efekt: niektoré plyny v atmosfére','multiple_choice','["odvádzajú všetko teplo","zachytávajú časť vyžarovaného tepla","nemajú vplyv","chladia planétu bezmedzne"]',1,1),
('q2-pre-topic15',15,'Počasie vs. klíma:','multiple_choice','["to isté","počasie krátkodobé, klíma dlhodobý priemer","klíma je jeden deň","nedefinovateľné"]',1,2),
('q3-pre-topic15',15,'CO₂ je skleníkový plyn.','true_false','["Pravda","Nepravda"]',0,3),
('q4-pre-topic15',15,'Jedna studená zima vyvracia merané dlhodobé otepľovanie.','true_false','["Pravda","Nepravda"]',1,4),
('q5-pre-topic15',15,'Oceány absorbujú časť CO₂ a ovplyvňujú okysľovanie.','true_false','["Pravda","Nepravda"]',0,5),
('q6-pre-topic15',15,'Ľudská činnosť zvýšila koncentráciu CO₂ od priemyselnej revolúcie.','true_false','["Pravda","Nepravda"]',0,6),
('q7-pre-topic15',15,'„Vedec nevie počasie na zajtra, tak nevie klímu“ je:','multiple_choice','["logicky správne","omyl — iné škály a dôkazy","vždy pravda","definícia IPCC"]',1,7),
('q8-pre-topic15',15,'Mitigácia klimatických zmien znamená najmä:','multiple_choice','["ignorovať emisie","znižovanie emisií a príčin","iba prispôsobenie","zákaz výskumu"]',1,8),
('q1-pre-topic16',16,'Spaced repetition znamená opakovanie:','multiple_choice','["iba v jeden deň","rozložené v čase","nikdy","len pasívne čítanie"]',1,1),
('q2-pre-topic16',16,'Aktívne vyvolávanie z pamäti často posilňuje učenie.','true_false','["Pravda","Nepravda"]',0,2),
('q3-pre-topic16',16,'Multitasking pri náročnom učení zvyčajne zvyšuje kvalitu.','true_false','["Pravda","Nepravda"]',1,3),
('q4-pre-topic16',16,'Kratšie bloky s prestávkami môžu pomôcť pozornosti.','true_false','["Pravda","Nepravda"]',0,4),
('q5-pre-topic16',16,'Spánok po učení môže podporiť konsolidáciu pamäte.','true_false','["Pravda","Nepravda"]',0,5),
('q6-pre-topic16',16,'Striedanie tém pri cvičení (interleaving) môže pomôcť prenosu.','true_false','["Pravda","Nepravda"]',0,6),
('q7-pre-topic16',16,'Len podčiarkovanie textu bez aktívnej práce je často slabá stratégia.','true_false','["Pravda","Nepravda"]',0,7),
('q8-pre-topic16',16,'Metakognícia znamená vedomie o vlastnom učení a stratégiách.','true_false','["Pravda","Nepravda"]',0,8),
('q1-pre-topic17',17,'Dospelý bez dychu/bez reakcie — čo najskôr:','multiple_choice','["čakať","privolať 112 a začať KPR podľa školenia","podávať vodu","masírovať srdce"]',1,1),
('q2-pre-topic17',17,'Európske tiesňové číslo je:','multiple_choice','["155","112","911","0800"]',1,2),
('q3-pre-topic17',17,'Pri masívnom krvácaní treba zastaviť krvácanie tlakom.','true_false','["Pravda","Nepravda"]',0,3),
('q4-pre-topic17',17,'Pri horiacom oblečení na osobe môže „stop, drop, roll“ pomôcť.','true_false','["Pravda","Nepravda"]',0,4),
('q5-pre-topic17',17,'Šok: nohy mierne vyvýšené môže byť vhodné len ak nehrozí zranenie chrbtice.','true_false','["Pravda","Nepravda"]',0,5),
('q6-pre-topic17',17,'Heimlich manéver je pri:','multiple_choice','["zástave srdca","úplnom upchaní dýchacích ciest pri vedomí","krvácaní","popálenine"]',1,6),
('q7-pre-topic17',17,'FAST skratka môže pomôcť zapamätať príznaky mŕtvice.','true_false','["Pravda","Nepravda"]',0,7),
('q8-pre-topic17',17,'AED môže použiť laik podľa pokynov zariadenia.','true_false','["Pravda","Nepravda"]',0,8)
ON CONFLICT (id) DO NOTHING;
