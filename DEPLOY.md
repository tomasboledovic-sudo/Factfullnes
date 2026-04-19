# Nasadenie: GitHub + Vercel

Repozitár: [tomasboledovic-sudo/Factfullnes](https://github.com/tomasboledovic-sudo/Factfullnes)

## 1. Git (prvý push)

```bash
cd /cesta/k/fact
git add -A
git commit -m "Initial deploy: LearnFlow frontend + API"
git branch -M main
git remote add origin https://github.com/tomasboledovic-sudo/Factfullnes.git
# ak už máš origin, použi: git remote set-url origin https://github.com/tomasboledovic-sudo/Factfullnes.git
git push -u origin main
```

`.env` sú v `.gitignore` — na GitHub sa nedostanú.

---

## 2. Vercel

### A) Jeden projekt (frontend + API na jednej doméne)

1. **New Project** → import repozitára.
2. **Root Directory:** nechaj **prázdny** (koreň repa) — použije sa **`vercel.json`** v koreni (`frontend/dist` + serverless `api/index.js`).
3. **Environment Variables** (rovnaké ako backend nižšie, okrem `VITE_*`):

| Premenná | Poznámka |
|----------|----------|
| `SUPABASE_URL` | z Supabase |
| `SUPABASE_ANON_KEY` alebo `SUPABASE_SERVICE_ROLE_KEY` | podľa kódu |
| `JWT_SECRET` | dlhý náhodný reťazec |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` | voliteľné, napr. `gemini-2.5-flash` |
| `ADMIN_EMAILS` | **voliteľné** — čiarka-oddelené emaily so správcovským prístupom (`/admin`, nahraté súbory); ak chýba, platí len meno `admin` alebo `admin@…` |
| `FRONTEND_URL` | **voliteľné** pri jednom projekte — CORS doplní `VERCEL_URL` automaticky; pri vlastnej doméne môžeš zadať `https://tvoja-domena.sk` |

**Frontend build** nepotrebuje `VITE_API_URL` — v produkcii sa volá relatívne `/api/...` (rovnaký pôvod). Lokálne (`npm run dev` vo fronte) ostáva predvolené `http://localhost:3001`.

4. Deploy. API bude na **`https://tvoj-projekt.vercel.app/api/...`**, rovnaká doména ako React app.

---

### B) Dva projekty (samostatný backend + frontend)

#### B1) Backend (API)

1. [Vercel Dashboard](https://vercel.com) → **Add New** → **Project** → Import repozitára.
2. **Root Directory:** `backend`
3. Framework: Other / Node (môže sa brať z `backend/vercel.json`).
4. **Environment Variables:**

| Premenná | Poznámka |
|----------|----------|
| `SUPABASE_URL` | z Supabase |
| `SUPABASE_ANON_KEY` alebo `SUPABASE_SERVICE_ROLE_KEY` | service role odporúčaný pre backend |
| `JWT_SECRET` | dlhý náhodný reťazec |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` | voliteľné, napr. `gemini-2.5-flash` |
| `ADMIN_EMAILS` | voliteľné — čiarka-oddelené emaily správcu (pozri vyššie) |
| `FRONTEND_URL` | presná URL frontendu na Vercel, napr. `https://tvoj-projekt.vercel.app` (bez lomky na konci) |

5. Deploy. Skopíruj URL backendu, napr. `https://fact-backend-xxx.vercel.app`.

#### B2) Frontend

1. **New Project** → ten istý repozitár.
2. **Root Directory:** `frontend`
3. Build: `npm run build`, Output: `dist` (štandard pre Vite).
4. **Environment Variables:**

| Premenná | Hodnota |
|----------|---------|
| `VITE_API_URL` | URL backendu **bez** `/api` na konci, napr. `https://fact-backend-xxx.vercel.app` |

5. Deploy.

6. Do backendu na Vercel doplň **`FRONTEND_URL`** = presná URL tohto frontend deploymentu a znova **Redeploy** backend.

---

## 3. Supabase

- V SQL editore spusti `supabase-setup.sql` a skripty z `backend/sql/` (file_metadata, FK, `generated_quiz`), ak ešte nie sú.
- Storage: bucket **`files`**, verejné URL podľa dokumentácie Supabase.

---

## 4. Kontrola

- Frontend: otvor stránku, prihlásenie, načítanie tém.
- `GET …/api/health` (rovnaká doména pri jednom projekte, alebo URL backendu pri dvoch) → JSON `success: true`.

Pri **dvoch projektoch**: ak prehliadač hlási CORS, skontroluj `FRONTEND_URL` na backende. Pri **jednom projekte** by mal stačiť automatický pôvod z `VERCEL_URL`.
