import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { AdminRoute } from '../components/AdminRoute'
import { UserLayout } from '../layouts/UserLayout'
import { AdminLayout } from '../layouts/AdminLayout'

// ── Public Pages ─────────────────────────────────────────────────────────────
import { LandingPage }        from '../pages/public/LandingPage'
import { LoginPage }          from '../pages/public/LoginPage'
import { RegisterPage }       from '../pages/public/RegisterPage'
import { ForgotPasswordPage } from '../pages/public/ForgotPasswordPage'

// ── User Pages (existing) ─────────────────────────────────────────────────────
import { UserDashboard }      from '../pages/user/UserDashboard'
import { PaperListPage }      from '../pages/user/PaperListPage'
import { PaperDetailPage }    from '../pages/user/PaperDetailPage'
import { ExamPage }           from '../pages/user/ExamPage'
import { ResultPage }         from '../pages/user/ResultPage'
import { QuestionReviewPage } from '../pages/user/QuestionReviewPage'
import { AttemptHistoryPage } from '../pages/user/AttemptHistoryPage'
import { CompareAttemptsPage }from '../pages/user/CompareAttemptsPage'

// ── User Pages (TNPSC new) ────────────────────────────────────────────────────
import { CurrentAffairsPage } from '../pages/user/CurrentAffairsPage'
import { GovtUpdatesPage }    from '../pages/user/GovtUpdatesPage'
import { PracticePage }       from '../pages/user/PracticePage'
import { MockTestsPage }      from '../pages/user/MockTestsPage'
import { SyllabusPage }       from '../pages/user/SyllabusPage'
import { AnalyticsPage }      from '../pages/user/AnalyticsPage'
import { NotesPage }          from '../pages/user/NotesPage'
import { BYOPPage }           from '../pages/user/BYOPPage'
import { ProfilePage }        from '../pages/user/ProfilePage'

// ── Admin Pages ───────────────────────────────────────────────────────────────
import { AdminDashboard }         from '../pages/admin/AdminDashboard'
import { AdminPapersPage }        from '../pages/admin/AdminPapersPage'
import { CreateEditPaperPage }    from '../pages/admin/CreateEditPaperPage'
import { QuestionManagementPage } from '../pages/admin/QuestionManagementPage'
import { ImportQuestionsPage }    from '../pages/admin/ImportQuestionsPage'
import { AdminPdfToJsonPage }     from '../pages/admin/AdminPdfToJsonPage'
import { AdminAttemptsPage }      from '../pages/admin/AdminAttemptsPage'
// TNPSC Admin CMS pages
import { AdminCurrentAffairsPage } from '../pages/admin/AdminCurrentAffairsPage'
import { AdminNotificationsPage }  from '../pages/admin/AdminNotificationsPage'
import { AdminSyllabusPage }       from '../pages/admin/AdminSyllabusPage'
import { AdminRecallPage }         from '../pages/admin/AdminRecallPage'
import { AdminUsersPage }          from '../pages/admin/AdminUsersPage'
import { AdminAnalyticsPage }      from '../pages/admin/AdminAnalyticsPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/"                  element={<LandingPage />} />
      <Route path="/login"             element={<LoginPage />} />
      <Route path="/register"          element={<RegisterPage />} />
      <Route path="/forgot-password"   element={<ForgotPasswordPage />} />
      <Route path="/admin/login"       element={<LoginPage isAdminLogin={true} />} />

      {/* ── User (protected, inside UserLayout with TNPSC sidebar) ── */}
      <Route element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
        {/* Dashboard */}
        <Route path="/dashboard"         element={<UserDashboard />} />

        {/* Papers + Attempts (existing) */}
        <Route path="/papers"            element={<PaperListPage />} />
        <Route path="/papers/:paperId"   element={<PaperDetailPage />} />
        <Route path="/attempt/:attemptId"        element={<ResultPage />} />
        <Route path="/attempt/:attemptId/result" element={<ResultPage />} />
        <Route path="/attempt/:attemptId/review" element={<QuestionReviewPage />} />
        <Route path="/my-attempts"       element={<AttemptHistoryPage />} />
        <Route path="/compare/:paperId"  element={<CompareAttemptsPage />} />

        {/* TNPSC new routes */}
        <Route path="/practice"          element={<PracticePage />} />
        <Route path="/mock-tests"        element={<MockTestsPage />} />
        <Route path="/syllabus"          element={<SyllabusPage />} />
        <Route path="/analytics"         element={<AnalyticsPage />} />
        <Route path="/current-affairs"   element={<CurrentAffairsPage />} />
        <Route path="/govt-updates"      element={<GovtUpdatesPage />} />
        <Route path="/my-papers"         element={<BYOPPage />} />
        <Route path="/notes"             element={<NotesPage />} />
        <Route path="/profile"           element={<ProfilePage />} />
      </Route>

      {/* ── Fullscreen Exam (no sidebar) ── */}
      <Route path="/exam/:paperId" element={<ProtectedRoute><ExamPage /></ProtectedRoute>} />

      {/* ── Admin ── */}
      <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route path="/admin"                              element={<AdminDashboard />} />
        <Route path="/admin/papers"                       element={<AdminPapersPage />} />
        <Route path="/admin/papers/create"                element={<CreateEditPaperPage />} />
        <Route path="/admin/papers/:paperId/edit"         element={<CreateEditPaperPage />} />
        <Route path="/admin/papers/:paperId/questions"    element={<QuestionManagementPage />} />
        <Route path="/admin/papers/:paperId/import"       element={<ImportQuestionsPage />} />
        <Route path="/admin/pdf-to-json"                  element={<AdminPdfToJsonPage />} />
        <Route path="/admin/attempts"                     element={<AdminAttemptsPage />} />
        {/* TNPSC CMS */}
        <Route path="/admin/current-affairs"              element={<AdminCurrentAffairsPage />} />
        <Route path="/admin/notifications"                element={<AdminNotificationsPage />} />
        <Route path="/admin/syllabus"                     element={<AdminSyllabusPage />} />
        <Route path="/admin/recall"                       element={<AdminRecallPage />} />
        <Route path="/admin/users"                        element={<AdminUsersPage />} />
        <Route path="/admin/analytics"                    element={<AdminAnalyticsPage />} />
        {/* Alias /admin/questions → papers list for now */}
        <Route path="/admin/questions"                    element={<AdminPapersPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
