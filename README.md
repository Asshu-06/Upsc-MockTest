# UPSC Previous-Year Question Paper Practice Platform

A full-stack UPSC Previous-Year Question Paper Practice Platform built using **React.js**, **Vite**, **Tailwind CSS**, **React Router DOM**, **Supabase** (PostgreSQL, Auth, Storage, Edge Functions), and a unified Flask application server.

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
* **PDF-to-JSON and Paper Creation**: Use the `text_extractor` project's Groq-backed page OCR, download the generated JSON, then upload that JSON while creating a paper. JSON imports into existing papers are also supported.
* **System Attempts Reporting**: Track platform-wide user exam submissions and score metrics.

---

## 🛠️ Technology Stack

* **Frontend**: React.js 18, Vite, Tailwind CSS, React Router v6, Lucide React Icons, React Hook Form, Zod, Recharts.
* **Backend & Security**: Supabase (PostgreSQL, Supabase Auth, Supabase Storage, Row Level Security, Supabase Edge Functions).
* **Application server**: Python Flask serves the built React app and PDF conversion APIs from one server.
* **PDF question extraction**: The admin converter calls `text_extractor/EXC.py`, which renders PDF pages and sends them to Groq for OCR. Page 1 is treated as the cover and extraction starts at page 2.

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
GEMINI_API_KEY=your-gemini-api-key
```

Install the Python server and `text_extractor` dependencies, then start the integrated app. In PowerShell:

```powershell
pip install -r pdf-extractor/requirements.txt
pip install -r "$env:USERPROFILE\text_extractor\requirements.txt"
npm start
```

The app expects `text_extractor` at `%USERPROFILE%\text_extractor` by default. Set `TEXT_EXTRACTOR_DIR` if it is elsewhere. Put `GROQ_API_KEY` in `text_extractor\.env`; do not paste API keys into the app or chat. The PDF pages are sent to Groq for OCR. `npm start` builds the React frontend and starts Flask on port 5000. Admins can use **PDF to JSON** to download the question array and upload it from **Create New Paper**. The separate `/api/extract` endpoint remains available for the user BYOP flow.

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

## 🌐 Deployment

Deploy the project to a Python-capable host that can run Node.js during the build. Install the Python dependencies, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `GEMINI_API_KEY`, then run `npm start`. The Flask process serves both the frontend build and `/api/extract`; a frontend-only static deployment does not include the PDF extractor.

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
