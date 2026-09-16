import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema } from '../../lib/validations'
import { useAuth } from '../../hooks/useAuth'
import { BookOpen, UserPlus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

export function RegisterPage() {
  const { register: signUp } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(registerSchema)
  })

  const onSubmit = async (data) => {
    setServerError(null)
    setSuccessMessage(null)
    setSubmitting(true)
    try {
      await signUp(data.email, data.password, data.fullName)
      setSuccessMessage('Registration successful! Redirecting to dashboard...')
      setTimeout(() => {
        navigate('/dashboard')
      }, 1500)
    } catch (err) {
      console.error('Registration error:', err)
      setServerError(err.message || 'Registration failed. Please check your inputs.')
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
          Create Aspirant Account
        </h2>
        <p className="mt-2 text-xs text-body-secondary">
          Join thousands of aspirants practicing authentic UPSC previous year papers
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

          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3 text-status-success text-xs font-semibold">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                {...register('fullName')}
                placeholder="Rahul Sharma"
                className="w-full px-4 py-2.5 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-status-error">{errors.fullName.message}</p>
              )}
            </div>

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
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                {...register('password')}
                placeholder="At least 6 characters"
                className="w-full px-4 py-2.5 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-status-error">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                {...register('confirmPassword')}
                placeholder="Re-enter password"
                className="w-full px-4 py-2.5 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-status-error">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-subtle transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Free Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-surface-border text-center text-xs text-body-secondary">
            <p>
              Already registered?{' '}
              <Link to="/login" className="font-bold text-primary hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
