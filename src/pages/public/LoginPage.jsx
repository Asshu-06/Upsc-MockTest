import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema } from '../../lib/validations'
import { useAuth } from '../../hooks/useAuth'
import { BookOpen, LogIn, AlertCircle, Loader2 } from 'lucide-react'

export function LoginPage({ isAdminLogin = false }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const from = location.state?.from?.pathname || (isAdminLogin ? '/admin' : '/dashboard')

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await login(data.email, data.password)
      navigate(from, { replace: true })
    } catch (err) {
      console.error('Login error:', err)
      setServerError(err.message || 'Invalid email or password credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-bold shadow-subtle mx-auto">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-primary">UPSC PrepHub</span>
        </Link>
        <h2 className="mt-6 text-2xl font-bold tracking-tight text-body-text">
          {isAdminLogin ? 'Admin Portal Sign In' : 'Sign in to your Account'}
        </h2>
        <p className="mt-2 text-xs text-body-secondary">
          {isAdminLogin ? 'Enter admin credentials to manage papers and questions' : 'Practice previous year papers and track your scores'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-card rounded-2xl border border-surface-border">
          {serverError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-status-error text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                {...register('email')}
                placeholder="aspirant@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-status-error">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-body-text uppercase tracking-wider">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                {...register('password')}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-status-error">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-subtle transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{isAdminLogin ? 'Sign In as Admin' : 'Sign In'}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-surface-border text-center text-xs text-body-secondary space-y-2">
            {!isAdminLogin ? (
              <p>
                Don't have an account?{' '}
                <Link to="/register" className="font-bold text-primary hover:underline">
                  Register here
                </Link>
              </p>
            ) : (
              <p>
                User looking for practice?{' '}
                <Link to="/login" className="font-bold text-primary hover:underline">
                  Standard Login
                </Link>
              </p>
            )}

            {!isAdminLogin && (
              <p className="pt-1">
                <Link to="/admin/login" className="text-slate-500 hover:text-slate-800 underline">
                  Admin Sign In Portal
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
