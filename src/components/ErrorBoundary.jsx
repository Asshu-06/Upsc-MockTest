import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-bg p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-card border border-surface-border p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 text-status-error rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-body-text">Application Exception</h2>
            <p className="text-xs text-body-secondary leading-relaxed">
              An unexpected error occurred while rendering this page.
            </p>
            {this.state.error?.message && (
              <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs font-mono text-left overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-subtle inline-flex items-center space-x-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
