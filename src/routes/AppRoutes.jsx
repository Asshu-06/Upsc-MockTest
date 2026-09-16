import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { AdminRoute } from '../components/AdminRoute'
import { UserLayout } from '../layouts/UserLayout'
import { AdminLayout } from '../layouts/AdminLayout'

// Public Pages
import { LandingPage } from '../pages/public/LandingPage'
import { LoginPage } from '../pages/public/LoginPage'
import { RegisterPage } from '../pages/public/RegisterPage'
import { ForgotPasswordPage } from '../pages/public/ForgotPasswordPage'

// User Pages
import { UserDashboard } from '../pages/user/UserDashboard'
import { PaperListPage } from '../pages/user/PaperListPage'
import { PaperDetailPage } from '../pages/user/PaperDetailPage'
import { ExamPage } from '../pages/user/ExamPage'
import { ResultPage } from '../pages/user/ResultPage'
import { QuestionReviewPage } from '../pages/user/QuestionReviewPage'
import { AttemptHistoryPage } from '../pages/user/AttemptHistoryPage'
import { CompareAttemptsPage } from '../pages/user/CompareAttemptsPage'

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard'
import { AdminPapersPage } from '../pages/admin/AdminPapersPage'
import { CreateEditPaperPage } from '../pages/admin/CreateEditPaperPage'
import { QuestionManagementPage } from '../pages/admin/QuestionManagementPage'
import { ImportQuestionsPage } from '../pages/admin/ImportQuestionsPage'
import { AdminAttemptsPage } from '../pages/admin/AdminAttemptsPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Admin Login Portal Direct Route */}
      <Route path="/admin/login" element={<LoginPage isAdminLogin={true} />} />

      {/* User Protected Routes with UserLayout */}
      <Route
        element={
          <ProtectedRoute>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/papers" element={<PaperListPage />} />
        <Route path="/papers/:paperId" element={<PaperDetailPage />} />
        <Route path="/attempt/:attemptId" element={<ResultPage />} />
        <Route path="/attempt/:attemptId/result" element={<ResultPage />} />
        <Route path="/attempt/:attemptId/review" element={<QuestionReviewPage />} />
        <Route path="/my-attempts" element={<AttemptHistoryPage />} />
        <Route path="/compare/:paperId" element={<CompareAttemptsPage />} />
      </Route>

      {/* Standalone Fullscreen Exam Page */}
      <Route
        path="/exam/:paperId"
        element={
          <ProtectedRoute>
            <ExamPage />
          </ProtectedRoute>
        }
      />

      {/* Admin Protected Routes with AdminLayout */}
      <Route
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/papers" element={<AdminPapersPage />} />
        <Route path="/admin/papers/create" element={<CreateEditPaperPage />} />
        <Route path="/admin/papers/:paperId/edit" element={<CreateEditPaperPage />} />
        <Route path="/admin/papers/:paperId/questions" element={<QuestionManagementPage />} />
        <Route path="/admin/papers/:paperId/import" element={<ImportQuestionsPage />} />
        <Route path="/admin/attempts" element={<AdminAttemptsPage />} />
      </Route>

      {/* Catch-all Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
