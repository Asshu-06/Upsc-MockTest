# UPSC Previous-Year Question Paper Practice Platform

A full-stack UPSC Previous-Year Question Paper Practice Platform built using **React.js**, **Vite**, **Tailwind CSS**, **React Router DOM**, **Supabase** (PostgreSQL, Auth, Storage, Edge Functions), and **Vercel Python Functions**.

---

## 🌟 Key Features

### User Application
* **Authenticated Aspirant Dashboard**: Overview of recent attempt performance, average scores, and accuracy metrics.
* **Filterable Papers Catalog**: Search papers by title, filter by year (2020-2024), exam type (Prelims, CSAT, Mains), subject, and sort order.
* **Timed Exam Engine**: Real-time single-question exam interface with answer palette navigation, "Mark for Review", answer clearing, and persistent countdown timer based on database `started_at` timestamps (resilient against page refreshes).
* **Server-Side Trusted Scoring**: Computes score using standard UPSC scoring rules (`+2.0` for correct, `-0.66` negative marking penalty, `0` for unanswered) via Supabase Edge Function (`submit-attempt`) or Postgres RPC (`submit_attempt_rpc`).
* **Attempt History & Consecutive Comparison**: Stores every attempt separately without overwriting. Compare latest attempt metrics against the immediately preceding attempt (Score change, Accuracy delta, Question-by-Question transitions like `Wrong → Correct`, `Stayed Correct`, `Unanswered → Correct`).
* **Question-Wise Review & Explanations**: Detailed solutions with filterable views for Correct, Incorrect, and Unanswered questions.

### Admin Dashboard
* **Paper CRUD & Publishing**: Create draft papers from a question JSON file, edit parameters, set duration/marking rules, and publish/unpublish/archive papers.
* **Question Management**: Manual question entry with live preview, update, reorder, and answer key configuration.
* **PDF-to-JSON and Paper Creation**: Use the repository's Groq vision-backed page OCR; extracted JSON is stored in the user's Supabase `documents.extracted_summary`, shown in the saved extraction history, and can be downloaded again. JSON imports into existing papers are also supported.
* **System Attempts Reporting**: Track platform-wide user exam submissions and score metrics.

---

## 🛠️ Technology Stack

* **Frontend**: React.js 18, Vite, Tailwind CSS, React Router v6, Lucide React Icons, React Hook Form, Zod, Recharts.
* **Backend & Security**: Supabase (PostgreSQL, Supabase Auth, Supabase Storage, Row Level Security, Supabase Edge Functions).
* **Application hosting**: Vercel serves the built React app and runs the Python PDF APIs as serverless functions.
* **PDF question extraction**: Both PDF workflows use the repository's Groq vision-backed OCR extractor. PDFs are uploaded to the authenticated Supabase `user-papers` bucket and passed to the API as signed URLs, avoiding Vercel's request-body upload limit.

---

## 🚀 Setup & Installation Instructions

### 1. Repository Setup

```bash
git clone https://github.com/your-username/upsc-exam-platform.git
cd upsc-exam-platform
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env`:

```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
GROQ_API_KEY=your-groq-api-key
```

For local development, first create an ignored `.env.local` file containing your Supabase settings and a newly generated Groq key. Do not reuse a key that was shared in chat:

```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
GROQ_API_KEY=your-new-groq-api-key
```

Run the local API and frontend in two PowerShell terminals from the repository root:

```powershell
# Terminal 1 — Python API; reads GROQ_API_KEY from .env.local
.\.venv\Scripts\python.exe .\local_api.py
```

```powershell
# Terminal 2 — Vite frontend, with /api requests proxied to the local Python API
npm run dev
```

Open `http://localhost:3000`. PDF OCR uses `GROQ_API_KEY` only on the server; never expose it through a `VITE_` variable or put it in browser code. Vercel deployments use the same Python API handlers in `api/`.

---

## 🗄️ Supabase Database & Security Setup

### 1. Database Schema & RLS Execution

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Run `00001_initial_schema.sql` through `00005_pdf_vision_pipeline.sql` from `supabase/migrations/` in numeric order.
   * These create the core schema, enable Row Level Security, configure user profiles and scoring, and add the application's TNPSC, BYOP, and PDF extraction tables.
   * Migration `00003_tnpsc_features.sql` creates the private `user-papers` Storage bucket and authenticated per-user upload/read/delete policies used by the BYOP and Vercel PDF workflows.
   * Do not also run `00000_combined_full_schema.sql` with the numbered migrations; it overlaps their schema.

### 2. Seed Sample UPSC Paper (Optional)

Run the SQL script from `supabase/seed.sql` in the SQL Editor to insert a published sample UPSC Prelims GS Paper 1 with 10 questions and answer keys.

### 3. Storage Bucket Configuration

1. In Supabase Dashboard, go to **Storage** -> **New Bucket**.
2. Bucket Name: `question-papers`
3. Toggle **Public** (or configure authenticated policy).

### 4. Admin Profile Assignment

To grant Admin privileges to a registered user account:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

---

## ⚡ Supabase Edge Function Deployment (`submit-attempt`)

The Edge Function handles server-side answer verification, trusted scoring calculation, and consecutive attempt comparison.

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```
2. Login & Link project:
   ```bash
   supabase login
   supabase link --project-ref your-supabase-project-ref
   ```
3. Deploy Edge Function:
   ```bash
   supabase functions deploy submit-attempt --no-verify-jwt
   ```

*Note: If Edge Functions are not deployed, the application seamlessly falls back to the database RPC function `submit_attempt_rpc`.*

---

## 🌐 Deploy frontend and backend to Vercel

The frontend and both Python API routes deploy from this repository as one Vercel project:

1. Push the repository to GitHub and import it into Vercel.
2. Set the project root to the repository root. Use `npm run build` as the build command and `dist` as the output directory.
3. Add these Vercel environment variables for Production and any Preview environments that need them:
   * `VITE_SUPABASE_URL` — the Supabase project URL.
   * `VITE_SUPABASE_ANON_KEY` — the public anon/publishable key; never use the service-role key in frontend code.
   * `GROQ_API_KEY` — the Groq API key, available only to the Python serverless functions.
4. In Supabase Authentication URL Configuration, set the Site URL to the Vercel production URL and add the production and preview URLs to allowed redirect URLs.
5. Apply migrations `00001` through `00005` in order. Migration `00003` creates the private `user-papers` bucket and policies used for BYOP and temporary PDF uploads. Keep the bucket's file-size limit at 35 MiB. Do not also run `00000_combined_full_schema.sql` alongside the numbered migrations.
6. Deploy. Vercel maps `api/extract.py` to `/api/extract` and `api/extract-json.py` to `/api/extract-json`; the SPA fallback in `vercel.json` continues to serve client-side routes.

PDFs are uploaded directly from the browser to Supabase Storage, then the API downloads them using a short-lived signed URL. This avoids Vercel's function request-body limit. Extraction is synchronous and must finish within the function's configured duration; very long documents may need to be split into background jobs. `/api/extract-json` uses Groq vision and treats page 1 as a cover page.

---

## 📐 Project Structure

```text
├── .env.example
├── README.md
├── index.html
├── package.json
├── pdf_api.py
├── requirements.txt
├── api/
│   ├── extract.py
│   └── extract-json.py
├── tailwind.config.js
├── vercel.json
├── vite.config.js
├── pdf-extractor/
│   ├── extract.py
│   ├── parser.py
│   ├── requirements.txt
│   └── README.md
├── supabase/
│   ├── migrations/
│   │   └── 00001_initial_schema.sql
│   ├── functions/
│   │   └── submit-attempt/
│   │       └── index.ts
│   └── seed.sql
└── src/
    ├── components/
    │   ├── Navbar.jsx
    │   ├── Sidebar.jsx
    │   ├── ProtectedRoute.jsx
    │   ├── AdminRoute.jsx
    │   ├── PaperCard.jsx
    │   ├── QuestionCard.jsx
    │   ├── Timer.jsx
    │   ├── QuestionNavigator.jsx
    │   ├── ResultSummary.jsx
    │   └── AttemptComparisonCard.jsx
    ├── contexts/
    │   └── AuthContext.jsx
    ├── hooks/
    │   ├── useAuth.js
    │   └── useTimer.js
    ├── layouts/
    │   ├── UserLayout.jsx
    │   └── AdminLayout.jsx
    ├── lib/
    │   ├── supabase.js
    │   ├── validations.js
    │   └── utils.js
    ├── pages/
    │   ├── public/ (Landing, Login, Register, ForgotPassword)
    │   ├── user/ (Dashboard, PaperList, PaperDetail, ExamPage, ResultPage, QuestionReview, AttemptHistory, CompareAttempts)
    │   └── admin/ (Dashboard, Papers, CreateEditPaper, QuestionManagement, ImportQuestions, AdminAttempts)
    ├── services/
    │   ├── authService.js
    │   ├── paperService.js
    │   ├── questionService.js
    │   ├── attemptService.js
    │   └── storageService.js
    ├── routes/
    │   └── AppRoutes.jsx
    ├── App.jsx
    └── main.jsx
```
"# Upsc-MockTest" 
