# 🎓 Factfullness - AI Vzdelávacia Aplikácia

Interaktívna vzdelávacia platforma s personalizovaným učebným obsahom generovaným pomocou Gemini API.

## 📋 Prehľad

Užívateľ si vyberie tému, spraví vstupný test, AI vygeneruje personalizovaný učebný materiál (10 min štúdia), potom spraví výstupný test a uvidí svoje zlepšenie.

## 🏗️ Architektúra

```
/fact
├── backend/           # Node.js + Express API
│   ├── controllers/   # Business logika
│   ├── services/      # Gemini API integrácia
│   ├── routes/        # API endpointy
│   └── data/          # JSON storage
│
└── frontend/          # React SPA
    ├── src/
    │   ├── components/ # Reusable komponenty
    │   ├── pages/      # Page komponenty
    │   └── config.js   # API konfigurácia
    └── public/
```

## 🚀 Rýchly Štart

### 1. Backend

```bash
cd backend
npm install
npm start
```

Backend beží na: `http://localhost:3000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend beží na: `http://localhost:5173`

## 🎯 User Flow

```
┌──────────────────┐
│   HomePage       │  Výber z 10 tém
│   (React)        │
└────────┬─────────┘
         ↓
┌──────────────────┐
│  PreAssessment   │  Vstupný test (8 otázok)
│   (React)        │
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Backend API     │  🤖 GEMINI API VOLANIE
│  /pre-test       │  Generovanie obsahu (~10s)
│  /submit          │
└────────┬─────────┘
         ↓
┌──────────────────┐
│  LearningPage    │  Štúdium materiálu (10 min)
│   (React)        │  Markdown rendering
└────────┬─────────┘
         ↓
┌──────────────────┐
│  PostAssessment  │  Výstupný test (8 otázok)
│   (React)        │
└────────┬─────────┘
         ↓
┌──────────────────┐
│  ResultsPage     │  Porovnanie pred/po
│   (React)        │  Percentuálne zlepšenie
└──────────────────┘
```

## 🤖 Gemini API Integrácia

### Kde sa volá?
`POST /api/sessions/:sessionId/pre-test/submit`

### Čo robí?
1. Vyhodnotí vstupný test
2. Identifikuje slabé miesta
3. Zavolá Gemini API s personalizovaným promptom
4. Vygeneruje 10-minútový učebný materiál
5. Uloží do session

### Počet volaní:
✅ **1 volanie na užívateľa a tému** (podľa požiadavky)

## 📊 Tech Stack

### Backend
- Node.js + Express
- Gemini 2.5 Flash API
- JSON file storage
- CORS enabled

### Frontend
- React 18
- React Router v6
- React Markdown
- Vite
- Native CSS

## 📁 API Endpoints

```
GET    /api/topics                         # Zoznam tém
POST   /api/sessions                       # Vytvorenie session
GET    /api/sessions/:id/pre-test         # Vstupné otázky
POST   /api/sessions/:id/pre-test/submit  # ⚡ Gemini API volanie
GET    /api/sessions/:id/content          # Učebný obsah
```

## 🎨 Dizajn

Inšpirované **Brilliant.org / Factfullness** dizajn audit:
- Minimalistický, čistý
- Inter font
- Modrá primárna farba (`#3B82F6`)
- Zelená akcentová (`#22C55E`)
- Responzívny (mobile-first)

## ✅ Implementované Funkcie

### Backend ✅
- ✅ Session management
- ✅ Statické otázky (pre/post test)
- ✅ Gemini API integrácia
- ✅ Personalizovaný prompt
- ✅ Vyhodnotenie testov
- ✅ Ukladanie výsledkov
- ✅ Error handling

### Frontend ✅
- ✅ 5 hlavných stránok (Home, PreTest, Learning, PostTest, Results)
- ✅ Komponentový prístup
- ✅ React Router navigácia
- ✅ API integrácia
- ✅ Loading states
- ✅ Progress tracking
- ✅ Markdown rendering
- ✅ Responzívny dizajn
- ✅ LocalStorage persistence

## 🧪 Testovanie

### Celý flow:
1. Otvorte `http://localhost:5173/`
2. Vyberte "Základy Fotosyntézy"
3. Vyplňte vstupný test (8 otázok)
4. Počkajte na generovanie (~10s)
5. Štúdujte obsah
6. Vyplňte výstupný test
7. Pozrite si výsledky

### Testované:
- ✅ Session creation
- ✅ Pre-test submission
- ✅ Gemini API response (~8-10s)
- ✅ Content generation (personalizované)
- ✅ Markdown rendering
- ✅ Results calculation

## 📦 Adresárová Štruktúra

```
/fact
├── backend/
│   ├── server.js
│   ├── controllers/
│   │   ├── assessmentController.js   # ⚡ Hlavný endpoint
│   │   ├── sessionController.js
│   │   └── topicController.js
│   ├── services/
│   │   └── geminiService.js          # 🤖 Gemini API
│   ├── routes/
│   ├── data/
│   │   ├── topics.json               # 2 témy
│   │   ├── preTestQuestions.json     # 8 otázok/téma
│   │   └── sessions.json             # Runtime storage
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navigation.jsx
│   │   │   ├── TopicCard.jsx
│   │   │   ├── QuestionCard.jsx
│   │   │   └── ContentSection.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── PreAssessmentPage.jsx
│   │   │   ├── LearningPage.jsx
│   │   │   ├── PostAssessmentPage.jsx
│   │   │   └── ResultsPage.jsx
│   │   ├── App.jsx
│   │   └── config.js
│   └── package.json
│
├── api/                   # Vercel serverless vstup (Express z backend/)
├── vercel.json            # Jeden Vercel projekt: frontend/dist + /api
└── README.md              # Tento súbor
```

## 🔧 Konfigurácia

### Backend `.env`
```
PORT=3000
GEMINI_API_KEY=your_api_key_here
```

### Frontend `src/config.js`
```javascript
export const API_BASE_URL = 'http://localhost:3000/api';
```

## 📈 Výsledky

### Live Test Session:
- Session ID: `e85bc5d5-55ec-46a5-be95-0cd9e3619343`
- Téma: Základy Fotosyntézy
- Vstupný test: **87.5%** (7/8)
- Gemini generoval: **4 sekcie, 10 minút**
- Obsah: Personalizovaný na chybu užívateľa

## 🎯 Features Roadmap

### V1 (Hotovo) ✅
- [x] Backend API s Gemini integráciou
- [x] Frontend s 5 stránkami
- [x] Vstupný/výstupný test
- [x] Personalizovaný obsah
- [x] Výsledky a pokrok

### V2 (Budúcnosť)
- [ ] User authentication
- [ ] Post-test endpoint (backend)
- [ ] Dashboard s históriou
- [ ] Viac tém (10+)
- [ ] Database (PostgreSQL/Supabase)
- [ ] Export výsledkov (PDF)
- [ ] Gamification (badges, streaks)

## 📝 Poznámky

- **Jediné Gemini API volanie** na session (optimalizácia nákladov)
- Obsah sa cachuje v session → bez duplicít
- Post-test momentálne simulovaný (demo)
- 2 témy v demo verzii (Fotosyntéza, Pytagorova veta)

## 🤝 Príspevky

Projekt vytvorený pre výučbové účely s Gemini API integráciou.

## 📄 Licencia

MIT

---

**Vyvinuté s ❤️ a Gemini AI**
