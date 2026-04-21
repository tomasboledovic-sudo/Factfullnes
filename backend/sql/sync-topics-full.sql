-- Synchronizácia tabuľky topics s aktuálnym katalógom v repozitári (15 tém, bez id 4 a 9).
-- Spusti v Supabase SQL Editor ak v aplikácii vidíš menej tém ako v Git-e.
-- Bezpečné opakované spustenie: existujúce id sa aktualizujú, nové sa vložia.

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

-- Ak má tabuľka pre_test_questions pre niektoré topic_id 0 riadkov, backend použije
-- zálohu z repozitára (data/preTestQuestions.json). Na úplné naplnenie DB môžeš
-- exportovať tieto dáta samostatnou migráciou.

-- Voliteľne: odstránenie zastaraných tém 4 a 9 (ak ešte existujú v DB)
-- DELETE FROM pre_test_questions WHERE topic_id IN (4, 9);
-- DELETE FROM sessions WHERE topic_id IN (4, 9);
-- DELETE FROM topics WHERE id IN (4, 9);
