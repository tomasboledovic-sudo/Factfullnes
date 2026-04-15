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

## 2. Vercel — dva projekty (odporúčané)

### A) Backend (API)

1. [Vercel Dashboard](https://vercel.com) → **Add New** → **Project** → Import repozitára.
2. **Root Directory:** `backend`
3. Framework: Other / Node (detekuje sa z `backend/vercel.json`).
4. **Environment Variables** (Settings → Environment Variables):

| Premenná | Poznámka |
|----------|----------|
| `SUPABASE_URL` | z Supabase |
| `SUPABASE_ANON_KEY` alebo `SUPABASE_SERVICE_ROLE_KEY` | service role odporúčaný pre backend |
| `JWT_SECRET` | dlhý náhodný reťazec |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` | voliteľné, napr. `gemini-2.5-flash` |
| `FRONTEND_URL` | presná URL frontendu na Vercel, napr. `https://tvoj-projekt.vercel.app` (bez lomky na konci) |

5. Deploy. Skopíruj URL backendu, napr. `https://fact-backend-xxx.vercel.app`.

### B) Frontend

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
- `GET https://tvoj-backend.vercel.app/api/health` → JSON `success: true`.

Ak prehliadač hlási CORS, skontroluj, že `FRONTEND_URL` na backende presne sedí s URL v adresnom riadku (vrátane `https`).
