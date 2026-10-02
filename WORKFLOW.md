# Vina AI TNPSC — Complete Working Platform Guide

> Last updated: September 2026  
> Stack: React 18 + Vite + Supabase + Tailwind CSS  
> Project: `c:\Users\jayas\OneDrive\Desktop\Upsc-Exam`

---

## 1. SETUP CHECKLIST (Do these once)

### 1.1 Environment Variables
File: `.env` in project root

```
VITE_SUPABASE_URL=https://gmwfgtnejfblmrmtmebh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 1.2 Run Migrations (Supabase SQL Editor)
Go to: https://supabase.com/dashboard/project/gmwfgtnejfblmrmtmebh/sql/new

Run in this exact order:

| Order | File | What it creates |
|-------|------|-----------------|
| 1 | `supabase/migrations/00000_combined_full_schema.sql` | profiles, papers, questions, attempts, attempt_answers, documents, extracted_questions |
| 2 | `supabase/migrations/00001_initial_schema.sql` | RLS policies, submit_attempt_rpc |
| 3 | `supabase/migrations/00002_pdf_extraction_schema.sql` | PDF extraction tables |
| 4 | `supabase/migrations/00003_tnpsc_features.sql` | current_affairs, govt_notifications, syllabus, quick_recall_sessions, user_streaks, practice_sessions, user_notes, uploaded_papers, exam_sessions |
| 5 | `supabase/migrations/00004_admin_cms.sql` | recall_questions, audit_log, admin_resources, extends profiles/syllabus/current_affairs |

### 1.3 Create Storage Bucket
Go to: https://supabase.com/dashboard/project/gmwfgtnejfblmrmtmebh/storage/buckets

- Name: `user-papers`
- Public: NO (private)
- File size limit: 35MB
- Allowed types: `application/pdf, image/jpeg, image/png`

OR run the SQL at the bottom of `00003_tnpsc_features.sql`.

### 1.4 Deploy Edge Function
```powershell
# Get token from: https://supabase.com/dashboard/account/tokens
npx supabase login --token YOUR_TOKEN
npx supabase functions deploy extract-pdf-questions --project-ref gmwfgtnejfblmrmtmebh
```

### 1.5 Set Gemini API Key Secret
Go to: https://supabase.com/dashboard/project/gmwfgtnejfblmrmtmebh/settings/vault  
Add secret: `GEMINI_API_KEY` = your Google Gemini API key

### 1.6 Run Locally
```powershell
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## 2. ADMIN ACCOUNTS

| Email | Password | Role |
|-------|----------|------|
| `aswaniadduri11@gmail.com` | (existing) | admin |
| `tonygokul30@gmail.com` | `admin@123` | admin |

Admin login URL: `/admin/login`  
Admin panel URL: `/admin`

---

## 3. COMPLETE WORKFLOW

### STEP 1 — Admin sets up exam structure

**URL:** `/admin/syllabus`

1. Three exams are pre-seeded by migration: **TNPSC Group 4**, **TNPSC Group 2/2A**, **TNPSC Group 1**
2. Click an exam → click **Add Unit**
3. Fill unit name (e.g. "General Studies"), unit number (1), subject (e.g. "General Studies")
4. Expand the unit → click **Add Topic**
5. Fill topic name (e.g. "Indian Polity"), topic number

> **Effect on student app:** `/syllabus` page shows these units/topics with progress tracking per student.  
> **Effect on Practice Builder:** subjects list is pulled from these unit names — only admin-added units appear.

---

### STEP 2 — Admin creates question papers

**URL:** `/admin/papers`

1. Click **Create New Paper**
2. Fill: Title, Exam Name (must match exactly: "TNPSC Group 4" etc.), Year, Subject, Duration
3. Save as Draft
4. Click **Questions** → add questions manually, OR click **Import** to upload CSV/JSON

**CSV format for bulk import:**
```
question_number,question_text,option_a,option_b,option_c,option_d,correct_option,explanation
1,What is...?,Option A,Option B,Option C,Option D,B,Explanation here
```

5. Once questions are added → click **Publish**

> **Effect on student app:**
> - `/mock-tests` shows this paper (filtered by exam)
> - `/papers` (PYQ) shows this paper
> - Practice Builder uses questions from this paper
> - Quick Recall falls back to these questions if recall_questions pool is empty

---

### STEP 3 — Admin adds Quick Recall questions

**URL:** `/admin/recall`

1. Click **New Question**
2. Fill: Subject, Topic, Difficulty, Question Text
3. Fill all 4 options (A/B/C/D)
4. Select the correct answer
5. Add explanation
6. Set Status = **published**, Active = **checked**
7. Save

> 5 sample questions are pre-seeded by `00004_admin_cms.sql`.  
> **Effect on student app:** Quick Recall game on `/dashboard` uses these questions first. Falls back to exam paper questions if pool is empty.

---

### STEP 4 — Admin adds Current Affairs

**URL:** `/admin/current-affairs`

1. Click **New Article**
2. Fill: Category (TN Schemes / Economy / Polity / Science / National / Sports), Title, Summary, Full Content
3. Add AI Key Takeaways — one per line, these appear as numbered bullets to students
4. Add Source Name + Source URL
5. Set Status = **published** → Save

> **Effect on student app:** `/current-affairs` page shows the article immediately. Dashboard shows latest 4 articles.

---

### STEP 5 — Admin adds Government Notifications

**URL:** `/admin/notifications`

1. Click **New Notification**
2. Fill: Department (TNPSC/TRB/TNEB/TNUSRB), Title, Post Name, Vacancies
3. Fill dates: Application Start, Application End, Exam Date
4. Paste official PDF URL, Official Portal URL, Apply URL
5. Write AI Exam Digest (summary shown to students in the drawer)
6. Set Status = **active** or **upcoming** → Save

> **Effect on student app:** `/govt-updates` page shows the notification. Students can click to open the drawer, download PDF, and apply.

---

### STEP 6 — Student experience

Students register at `/register` or login at `/login`.

#### On first login:
- Dashboard loads with their selected exam (default: TNPSC Group 4)
- Streak card shows 0 streak, 0 points

#### Switching exams:
The **exam selector in the sidebar** changes:
- Dashboard stats (attempts, accuracy) → filtered to that exam
- Mock Tests list → only papers for that exam
- Practice Builder subjects → only subjects admin added for that exam
- Syllabus → only units/topics for that exam
- Analytics → only attempts for that exam papers

#### Quick Recall (from Dashboard):
1. Click **Start Quick Recall**
2. 5 questions load (from admin's recall_questions, or paper questions as fallback)
3. Click an option to answer
4. Correct → streak +1 | Wrong → streak resets to 0
5. After 5 questions → result screen shows score, streak earned, points
6. Points saved server-side via RPC (cannot be manipulated by client)

#### Custom Practice:
1. Go to `/practice`
2. Select Subject (from admin-defined syllabus units)
3. Select question count (10/25/50/100)
4. Select timer mode (Strict Countdown or Untimed)
5. Select difficulty
6. Click **Generate Practice Set**
7. Questions load only from papers matching the selected exam
8. Navigate with Previous/Next, click option to answer
9. Submit → see score, accuracy, per-question review

#### Full Mock Test:
1. Go to `/mock-tests`
2. Papers listed are filtered by selected exam
3. Click **Start** → goes to full exam page (`/exam/:paperId`)
4. Timed exam with navigation, mark for review
5. Submit → result with score, accuracy, comparison with previous attempt

#### BYOP (Bring Your Own Paper):
1. Go to `/my-papers`
2. Click **Upload Paper** → select PDF/JPG/PNG
3. File uploads to Supabase Storage bucket `user-papers`
4. Record created in `uploaded_papers` table (status: uploaded)
5. Click **Process** → calls Gemini AI edge function
6. AI extracts questions page by page
7. If successful: questions saved, draft paper created, status → ready
8. If failed: status → failed, click Retry

#### Current Affairs:
1. Go to `/current-affairs`
2. Filter by category
3. Click an article → slide-over drawer opens with full content + AI takeaways

#### Govt Updates:
1. Go to `/govt-updates`
2. Click a notification → drawer opens
3. **Download PDF** → opens actual PDF URL in new tab
4. **Official Portal** → opens official government URL
5. **Apply Now** → opens application URL

#### Syllabus Tracker:
1. Go to `/syllabus`
2. Click a unit to expand
3. Each topic has a status dropdown: Not Started / In Progress / Completed / Needs Revision
4. Selecting a status saves to database immediately
5. Overall mastery % calculated from completed topics

#### Smart Notes:
1. Go to `/notes`
2. Click **New Note** → fill title, content, subject, topic
3. Choose color, pin if important
4. Pinned notes appear on dashboard
5. Notes are private — only visible to the owner

#### Analytics:
1. Go to `/analytics`
2. Shows stats only for the currently selected exam
3. Accuracy trend chart, subject breakdown, AI recommendations

#### AI Copilot:
- Floating button in bottom-right corner (always visible)
- Click to open chat
- Ask anything about preparation strategy, syllabus, current affairs
- Context-aware responses based on selected exam

---

## 4. DATABASE TABLES REFERENCE

| Table | Purpose | Who writes | Who reads |
|-------|---------|-----------|-----------|
| `profiles` | User profile, selected_exam, language | User (self) | User, Admin |
| `papers` | Question papers | Admin | Students (published only) |
| `questions` | Individual questions | Admin | Students (exam mode strips correct_option) |
| `attempts` | Exam attempt records | System (RPC) | User (own), Admin (all) |
| `attempt_answers` | Per-question answers | System | User (own), Admin |
| `current_affairs` | News articles | Admin | Students (published + is_active) |
| `government_notifications` | Job notifications | Admin | Students (all) |
| `syllabus_exams` | TNPSC exam list | Admin | Students (read-only) |
| `syllabus_units` | Units per exam | Admin | Students (read-only) |
| `syllabus_topics` | Topics per unit | Admin | Students (read-only) |
| `user_syllabus_progress` | Per-topic status per user | User (own) | User (own only) |
| `recall_questions` | Admin's recall question bank | Admin | Students (active+published) |
| `quick_recall_sessions` | Recall game session | System | User (own only) |
| `quick_recall_answers` | Per-question recall answers | System | User (own only) |
| `user_streaks` | Streak + points per user | System (RPC) | User (own only) |
| `practice_sessions` | Custom practice sessions | System | User (own only) |
| `user_notes` | Personal study notes | User (own) | User (own only) |
| `uploaded_papers` | BYOP uploads | User (own) | User (own only) |
| `exam_sessions` | Resumable mock test state | System | User (own only) |
| `audit_log` | Admin action log | System | Admin only |
| `admin_resources` | Admin-published study material | Admin | Students (published) |
| `documents` | PDF extraction metadata | User | User (own) |
| `extracted_questions` | AI-extracted questions | System | User (own) |

---

## 5. ROUTES MAP

### Public
| Route | Page |
|-------|------|
| `/` | Landing Page |
| `/login` | Login |
| `/register` | Register |
| `/forgot-password` | Forgot Password |
| `/admin/login` | Admin Login |

### Student (protected — requires login)
| Route | Page |
|-------|------|
| `/dashboard` | TNPSC Command Center |
| `/papers` | Previous Year Papers (filtered by exam) |
| `/papers/:paperId` | Paper Detail |
| `/exam/:paperId` | Full-screen Exam |
| `/attempt/:attemptId/result` | Exam Result |
| `/attempt/:attemptId/review` | Question Review |
| `/my-attempts` | Attempt History |
| `/practice` | Custom Practice Builder |
| `/mock-tests` | Full Mock Tests (filtered by exam) |
| `/syllabus` | Interactive Syllabus (filtered by exam) |
| `/analytics` | Master Analytics (filtered by exam) |
| `/current-affairs` | Current Affairs CMS reader |
| `/govt-updates` | Government Notifications |
| `/my-papers` | BYOP — Bring Your Own Paper |
| `/notes` | Smart Notes |
| `/profile` | Profile & Settings |

### Admin (protected — requires admin role)
| Route | Page |
|-------|------|
| `/admin` | Admin Dashboard |
| `/admin/papers` | Paper Management |
| `/admin/papers/create` | Create Paper |
| `/admin/papers/:id/questions` | Question Manager |
| `/admin/papers/:id/import` | Bulk Import Questions |
| `/admin/questions` | Question Bank (alias to papers) |
| `/admin/syllabus` | Syllabus Manager (Exam/Unit/Topic) |
| `/admin/recall` | Quick Recall Question Bank |
| `/admin/current-affairs` | Current Affairs CMS |
| `/admin/notifications` | Government Notifications CMS |
| `/admin/users` | User Management |
| `/admin/analytics` | Platform Analytics |
| `/admin/attempts` | All Attempt Reports |

---

## 6. KEY BUSINESS RULES

### Exam Filtering
- All student-facing content filters by `selectedExam` from context
- Changing exam in sidebar instantly reloads: Dashboard, Mock Tests, Papers, Practice, Analytics, Syllabus
- Practice Builder subjects come from `syllabus_units.subject` for the selected exam (not hardcoded)

### Scoring (Server-side, cannot be manipulated)
- Attempt scoring: handled by `submit_attempt_rpc` PostgreSQL function OR `/functions/v1/submit-attempt` edge function
- Quick Recall streak: handled by `update_streak_after_recall` PostgreSQL RPC
- Never trust client-calculated scores

### Streak Rules
- Each correct Quick Recall answer: streak +1
- Any wrong answer: streak resets to 0
- Points: 10 per correct answer
- Stored in `user_streaks` table, updated server-side

### Content Visibility
- Papers: only `status = 'published'` visible to students
- Current Affairs: only `is_active = true` AND `status = 'published'`
- Recall Questions: only `is_active = true` AND `status = 'published'`
- Government Notifications: all statuses visible (active/upcoming/closed/results_out)

### BYOP Processing States
```
uploaded → processing → extracted → review_required → ready
                                                    ↘ failed
```

---

## 7. ADMIN CONTENT SYNC — How data flows

```
Admin Action                    →  Database              →  Student Sees
─────────────────────────────────────────────────────────────────────────
Publish paper                  →  papers.status=published  →  Mock Tests, PYQ
Add syllabus unit              →  syllabus_units            →  Practice subjects, Syllabus page
Add recall question (active)   →  recall_questions          →  Quick Recall pool
Publish current affairs        →  current_affairs           →  Dashboard + /current-affairs
Create notification (active)   →  government_notifications  →  Dashboard + /govt-updates
```

---

## 8. TROUBLESHOOTING

| Problem | Cause | Fix |
|---------|-------|-----|
| Quick Recall shows "Not enough questions" | No active recall_questions AND no published papers | Admin → /admin/recall → add questions OR publish a paper |
| Practice Builder shows only "All Subjects" | No syllabus units for that exam | Admin → /admin/syllabus → add units with subject field |
| Mock Tests page empty | No papers with `exam_name` matching selected exam | Admin → /admin/papers → create paper, set exam_name exactly (e.g. "TNPSC Group 4") |
| Current Affairs empty | No published articles | Admin → /admin/current-affairs → create and publish |
| BYOP upload fails with RLS error | Storage policy issue | Run storage SQL from `00003_tnpsc_features.sql` |
| BYOP process fails | Edge function not deployed OR Gemini key missing | Deploy edge function + set GEMINI_API_KEY secret |
| Syllabus not updating on exam switch | - | Already fixed: key={selectedExam} forces remount |
| Admin can't access /admin | User not in admin role | Run: `UPDATE profiles SET role='admin' WHERE email='your@email.com';` |

---

## 9. TECH STACK SUMMARY

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, React Router v6 |
| Styling | Tailwind CSS 3 with custom TNPSC design tokens |
| Forms | React Hook Form + Zod validation |
| Charts | Recharts |
| Icons | Lucide React |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| AI/OCR | Google Gemini API (via Supabase Edge Function) |
| PDF parsing | pdfjs-dist (client-side rendering to canvas) |
| CSV parsing | PapaParse |
| State | React Context (AuthContext + AppContext) |
| i18n | Custom context-based (EN + Tamil) |

---

## 10. FILE STRUCTURE (key files only)

```
src/
├── App.jsx                          — Root: BrowserRouter > AuthProvider > AppProvider > AppRoutes
├── contexts/
│   ├── AuthContext.jsx              — user, profile, isAdmin, login, logout, refreshProfile
│   └── AppContext.jsx               — selectedExam, language, toast, t() i18n helper
├── routes/
│   └── AppRoutes.jsx                — All routes (public + student + admin)
├── layouts/
│   ├── UserLayout.jsx               — Dark sidebar + main area + ToastContainer + AICopilot
│   └── AdminLayout.jsx              — Admin dark sidebar + main area + ToastContainer
├── components/
│   ├── tnpsc/
│   │   ├── TnpscSidebar.jsx         — Student nav sidebar
│   │   ├── AICopilot.jsx            — Floating AI chat button
│   │   ├── QuickRecall.jsx          — 5-question streak game modal
│   │   └── InteractiveSyllabus.jsx  — Syllabus modal (used on dashboard)
│   ├── admin/
│   │   └── AdminSidebar.jsx         — Admin nav sidebar
│   └── ui/
│       ├── Modal.jsx                — Reusable modal (ESC, backdrop, focus)
│       ├── Drawer.jsx               — Slide-over drawer
│       └── ToastContainer.jsx       — Toast notifications
├── pages/
│   ├── user/
│   │   ├── UserDashboard.jsx        — Command center
│   │   ├── PracticePage.jsx         — Practice builder + session + result
│   │   ├── MockTestsPage.jsx        — Mock test launcher
│   │   ├── SyllabusPage.jsx         — Inline syllabus tracker
│   │   ├── CurrentAffairsPage.jsx   — Articles + drawer
│   │   ├── GovtUpdatesPage.jsx      — Notifications + drawer
│   │   ├── AnalyticsPage.jsx        — Charts + recommendations
│   │   ├── NotesPage.jsx            — CRUD notes with pin/color
│   │   ├── BYOPPage.jsx             — Upload + AI process
│   │   └── ProfilePage.jsx          — Settings + language
│   └── admin/
│       ├── AdminDashboard.jsx        — Stats + quick actions + alerts
│       ├── AdminCurrentAffairsPage.jsx — Articles CMS
│       ├── AdminNotificationsPage.jsx  — Notifications CMS
│       ├── AdminSyllabusPage.jsx       — Exam/Unit/Topic manager
│       ├── AdminRecallPage.jsx         — Recall question bank
│       ├── AdminUsersPage.jsx          — User list + role management
│       ├── AdminAnalyticsPage.jsx      — Platform analytics + charts
│       ├── AdminPapersPage.jsx         — Paper management
│       ├── QuestionManagementPage.jsx  — Per-paper question CRUD
│       ├── ImportQuestionsPage.jsx     — CSV/JSON bulk import
│       └── AdminAttemptsPage.jsx       — All attempt reports
├── services/
│   ├── tnpscService.js              — currentAffairs, syllabus, quickRecall, practice, notes, byop, analytics
│   ├── adminService.js              — adminStats, adminAffairs, adminNotif, adminSyllabus, adminRecall, adminUser, adminAnalytics
│   ├── paperService.js              — papers CRUD + examName filter
│   ├── attemptService.js            — attempts + getUserAttemptsByExam
│   ├── questionService.js           — questions CRUD + batch import
│   ├── authService.js               — auth helpers
│   ├── geminiOcrService.js          — PDF → canvas → edge function → questions
│   └── storageService.js            — file storage helpers
├── hooks/
│   ├── useAuth.js                   — useAuth hook
│   ├── useTimer.js                  — timestamp-based exam timer
│   └── useCountdown.js              — simple countdown timer
└── lib/
    ├── supabase.js                  — Supabase client
    ├── utils.js                     — cn(), formatDate(), formatScore(), calculateAccuracy()
    └── validations.js               — Zod schemas

supabase/
├── migrations/
│   ├── 00000_combined_full_schema.sql
│   ├── 00001_initial_schema.sql
│   ├── 00002_pdf_extraction_schema.sql
│   ├── 00003_tnpsc_features.sql
│   └── 00004_admin_cms.sql
└── functions/
    └── extract-pdf-questions/
        └── index.ts                 — Gemini API caller with model fallback
```
