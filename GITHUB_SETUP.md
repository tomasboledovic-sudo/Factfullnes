# 🚀 GitHub Setup - Factfullness

## ✅ Pripravené

Git repository je inicializovaný a všetky súbory sú commitnuté!

```
✅ 61 súborov commitnutých
✅ 12,729 riadkov kódu
✅ README.md vytvorený
✅ LICENSE (MIT) pridaný
✅ .gitignore nastavený
```

---

## 📝 Krok 1: Vytvorte GitHub Repository

1. Otvorte [github.com](https://github.com) a prihláste sa
2. Kliknite na zelené tlačidlo **"New"** alebo **"+"** → **"New repository"**
3. Vyplňte detaily:
   - **Repository name:** `factfullness` (alebo iný názov)
   - **Description:** `AI-powered personalized learning platform`
   - **Visibility:** Public alebo Private (podľa vášho výberu)
   - **NEPOUŽÍVAJTE:** Add README, .gitignore, license (už máme)
4. Kliknite **"Create repository"**

---

## 📤 Krok 2: Push na GitHub

Po vytvorení repository GitHub zobrazí inštrukcie. Použite tieto príkazy:

### Metóda 1: HTTPS (Jednoduchšia)

```bash
cd /Users/t0mib/fact
git remote add origin https://github.com/YOUR_USERNAME/factfullness.git
git branch -M main
git push -u origin main
```

### Metóda 2: SSH (Pre pokročilých)

Ak máte SSH kľúče nastavené:

```bash
cd /Users/t0mib/fact
git remote add origin git@github.com:YOUR_USERNAME/factfullness.git
git branch -M main
git push -u origin main
```

**⚠️ NAHRAĎTE `YOUR_USERNAME` vaším GitHub používateľským menom!**

---

## 🔑 Autentifikácia

### Pre HTTPS:

Pri prvom push-e budete musieť zadať:
- **Username:** Vaše GitHub username
- **Password:** Personal Access Token (NIE vaše heslo!)

#### Ako získať Personal Access Token:

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token** → **Generate new token (classic)**
3. Nastavte:
   - **Note:** "Factfullness project"
   - **Expiration:** 90 days (alebo No expiration)
   - **Scopes:** Zaškrtnite **repo** (celý checkbox)
4. **Generate token**
5. **SKOPÍRUJTE TOKEN** (neuvidíte ho znova!)
6. Použite token ako heslo pri git push

---

## ✅ Krok 3: Overte Push

Po úspešnom push-e:

1. Otvorte `https://github.com/YOUR_USERNAME/factfullness`
2. Mali by ste vidieť:
   - ✅ Všetky súbory a priečinky
   - ✅ README.md zobrazený na homepage
   - ✅ Zelený "61 files changed" v commit history
   - ✅ MIT License badge

---

## 🎯 Voliteľné: Nastavenie GitHub Pages

Ak chcete hostiť frontend na GitHub Pages:

1. Repository → **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** main → `/frontend/dist`
4. **Save**

**Poznámka:** Musíte najprv zbuildovať frontend:
```bash
cd frontend
npm run build
git add dist/
git commit -m "Add build files for GitHub Pages"
git push
```

---

## 📊 Repository Statistics

Po push-e GitHub automaticky detekuje:
- **Languages:** JavaScript (React + Node.js)
- **Topics:** Môžete pridať: `react`, `nodejs`, `gemini-api`, `education`, `ai`
- **About:** Môžete upraviť v Settings

---

## 🔄 Ďalšie Commity

Pri budúcich zmenách:

```bash
# 1. Skontrolujte zmeny
git status

# 2. Pridajte súbory
git add .

# 3. Commitnite
git commit -m "Popis zmien"

# 4. Push na GitHub
git push
```

---

## 🛡️ Dôležité Poznámky

### ⚠️ NEZDIEĽAJTE API KĽÚČE!

Váš `.gitignore` už obsahuje:
```
.env
backend/.env
```

**Nikdy necommitujte `.env` súbory s API kľúčmi!**

Ak ste už commitli API kľúč:
1. Zrušte ho v Google Cloud Console
2. Vygenerujte nový
3. Použite `git filter-branch` na vymazanie z histórie

### 📝 GitHub Repository Description

Odporúčaný popis:
```
🎓 AI-powered personalized learning platform. 
Select a topic, take an assessment, get custom AI-generated 
learning materials, and track your progress. 
Built with React + Node.js + Google Gemini API.
```

### 🏷️ Topics (Tags)

Pridajte tieto topics pre lepšiu vyhľadateľnosť:
- `react`
- `nodejs`
- `express`
- `gemini-api`
- `artificial-intelligence`
- `education`
- `learning-platform`
- `personalized-learning`
- `vite`
- `fullstack`

---

## 📸 Screenshots

Pre lepšiu prezentáciu vytvorte screenshots a pridajte ich do `/screenshots/`:

```bash
mkdir screenshots
# Pridajte obrázky homepage, testov, výsledkov
git add screenshots/
git commit -m "Add screenshots"
git push
```

Potom v README.md pridajte:
```markdown
## 📸 Screenshots

![Homepage](screenshots/homepage.png)
![Test](screenshots/test.png)
![Results](screenshots/results.png)
```

---

## 🎉 Hotovo!

Váš projekt je teraz na GitHub! 🚀

**URL:** `https://github.com/YOUR_USERNAME/factfullness`

Môžete teraz:
- ⭐ Star svoj vlastný projekt
- 📢 Zdieľať s priateľmi
- 📝 Pridať do portfolia
- 🔄 Spolupracovať s ostatnými

---

## 🆘 Troubleshooting

### Problém: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/factfullness.git
```

### Problém: "Authentication failed"
- Použite Personal Access Token namiesto hesla
- Overte si username

### Problém: "Permission denied (publickey)"
- Použite HTTPS namiesto SSH
- Alebo nastavte SSH kľúče

---

**Úspech!** 🎊

