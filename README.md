# UPSC Previous-Year Question Paper Practice Platform

A full-stack, production-ready UPSC Previous-Year Question Paper Practice Platform built using **React.js**, **Vite**, **Tailwind CSS**, **React Router DOM**, **Supabase** (PostgreSQL, Auth, Storage, Edge Functions), and configured for **Vercel** deployment.

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
* **Paper CRUD & Publishing**: Create draft papers, upload official PDF documents to Supabase Storage (`question-papers`), edit parameters, set duration/marking rules, and publish/unpublish/archive papers.
* **Question Management**: Manual question entry with live preview, update, reorder, and answer key configuration.
* **JSON / CSV Batch Importer**: Browser-side parsing of bulk JSON/CSV question callsets with inline validation, duplicate detection, and live table preview prior to database commit.
* **System Attempts Reporting**: Track platform-wide user exam submissions and score metrics.

---

## 🛠️ Technology Stack

* **Frontend**: React.js 18, Vite, Tailwind CSS, React Router v6, Lucide React Icons, React Hook Form, Zod, Recharts, Papaparse.
* **Backend & Security**: Supabase (PostgreSQL, Supabase Auth, Supabase Storage, Row Level Security, Supabase Edge Functions).
* **Deployment**: Vercel (Frontend SPA), Supabase Cloud (Database / Auth / Edge Functions).
* **Extraction Utility**: Python, PyMuPDF (fitz) for local PDF text extraction to structured JSON.

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
```

---

## 🗄️ Supabase Database & Security Setup

### 1. Database Schema & RLS Execution

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Run the SQL script from `supabase/migrations/00001_initial_schema.sql`.
   * This creates `profiles`, `papers`, `questions`, `attempts`, and `attempt_answers` tables with unique indexes.
   * Enables Row Level Security (RLS) on all tables.
   * Configures trigger `on_auth_user_created` to automatically create user profiles upon sign up.
   * Creates the trusted Postgres scoring stored procedure `submit_attempt_rpc`.

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

## 📄 Local PDF Extraction Utility (`pdf-extractor/`)

Located in `pdf-extractor/`:

1. Install dependencies:
   ```bash
   pip install -r pdf-extractor/requirements.txt
   ```
2. Extract text from text-based UPSC question paper PDF:
   ```bash
   python pdf-extractor/extract.py path/to/upsc_2023.pdf extracted.txt
   ```
3. Parse extracted text into platform import JSON:
   ```bash
   python pdf-extractor/parser.py extracted.txt questions_import.json
   ```
4. Upload `questions_import.json` in **Admin Dashboard -> Papers -> Import Questions**.

---

## 🌐 Vercel Deployment Instructions

1. Push code to GitHub repository.
2. Log into **Vercel** and select **Add New Project**.
3. Import your GitHub repository.
4. Framework Preset: **Vite**.
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Add Environment Variables:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY`
8. Deploy!

*`vercel.json` is included with SPA rewrite rules to support direct URL route refreshes.*

---

## 📐 Project Structure

```text
├── .env.example
├── README.md
├── index.html
├── package.json
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
