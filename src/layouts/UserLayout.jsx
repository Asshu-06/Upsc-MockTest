import React from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from '../components/Navbar'

export function UserLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-bg text-body-text">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <footer className="bg-white border-t border-surface-border py-6 mt-12 text-center text-xs text-body-secondary">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} UPSC PrepHub Platform. Built for Civil Services Aspirants.</p>
        </div>
      </footer>
    </div>
  )
}
