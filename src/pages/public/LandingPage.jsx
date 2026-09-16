import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Award, Clock, ShieldCheck, CheckCircle2, ArrowRight, GitCompare, BarChart } from 'lucide-react'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-bg flex flex-col">
      {/* Header / Nav */}
      <header className="bg-white border-b border-surface-border py-4 px-6 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-bold shadow-subtle">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-primary block leading-tight">UPSC PrepHub</span>
              <span className="text-[10px] text-body-secondary font-medium uppercase">PYQ Exam Platform</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to="/login"
              className="text-sm font-semibold text-body-secondary hover:text-primary px-4 py-2 transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-subtle transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-white to-surface-bg py-16 md:py-24 px-6 border-b border-surface-border text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 text-primary border border-blue-100 rounded-full text-xs font-bold uppercase tracking-wider">
            <Award className="w-4 h-4" />
            <span>Dedicated UPSC Prelims Practice</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-body-text tracking-tight leading-tight">
            Master UPSC Previous-Year Question Papers with Precision
          </h1>

          <p className="text-base sm:text-lg text-body-secondary max-w-2xl mx-auto leading-relaxed">
            Practice authenticated UPSC Prelims papers in timed exam mode. Get instant score analytics, negative marking calculations, and compare your progress attempt-by-attempt.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-base shadow-card transition-all flex items-center justify-center space-x-2"
            >
              <span>Start Free Practice</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-white border border-surface-border text-body-text hover:bg-slate-50 rounded-xl font-bold text-base shadow-subtle transition-all text-center"
            >
              Log In to Account
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-body-text">Engineered for Civil Services Aspirants</h2>
          <p className="text-sm text-body-secondary mt-2">Comprehensive features designed for rigorous exam preparation.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white p-6 rounded-2xl border border-surface-border shadow-card space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-primary rounded-xl flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-body-text">Real Exam Engine & Timer</h3>
            <p className="text-xs text-body-secondary leading-relaxed">
              Experience the actual exam pressure with database-anchored countdown timers that persist across page refreshes.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-6 rounded-2xl border border-surface-border shadow-card space-y-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-body-text">Trusted Server Scoring</h3>
            <p className="text-xs text-body-secondary leading-relaxed">
              Official UPSC scoring formula applied (+2.0 for correct, -0.66 negative marking) via secure Supabase functions.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white p-6 rounded-2xl border border-surface-border shadow-card space-y-3">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
              <GitCompare className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-body-text">Consecutive Attempt Comparison</h3>
            <p className="text-xs text-body-secondary leading-relaxed">
              Track progress between consecutive attempts. Compare score increases, accuracy changes, and question-by-question transitions.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
