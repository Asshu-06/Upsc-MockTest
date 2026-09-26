import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ─── i18n strings ────────────────────────────────────────────────────────────
const translations = {
  en: {
    dashboard:       'Dashboard',
    practice:        'Practice',
    mockTests:       'Mock Tests',
    pyq:             'Previous Year Papers',
    syllabus:        'Syllabus',
    analytics:       'Analytics',
    currentAffairs:  'Current Affairs',
    govtUpdates:     'Govt Updates',
    myPapers:        'My Papers',
    notes:           'My Notes',
    welcome:         'Welcome back',
    loading:         'Loading...',
    save:            'Save',
    cancel:          'Cancel',
    delete:          'Delete',
    edit:            'Edit',
    close:           'Close',
    submit:          'Submit',
    next:            'Next',
    previous:        'Previous',
    resume:          'Resume',
    discard:         'Discard',
    correct:         'Correct',
    wrong:           'Wrong',
    score:           'Score',
    accuracy:        'Accuracy',
    streak:          'Streak',
    points:          'Points',
  },
  ta: {
    dashboard:       'டாஷ்போர்டு',
    practice:        'பயிற்சி',
    mockTests:       'மாக் தேர்வுகள்',
    pyq:             'முந்தைய ஆண்டு கேள்விகள்',
    syllabus:        'பாடத்திட்டம்',
    analytics:       'பகுப்பாய்வு',
    currentAffairs:  'நடப்பு நிகழ்வுகள்',
    govtUpdates:     'அரசு அறிவிப்புகள்',
    myPapers:        'என் கேள்வித்தாள்கள்',
    notes:           'என் குறிப்புகள்',
    welcome:         'மீண்டும் வரவேற்கிறோம்',
    loading:         'ஏற்றுகிறது...',
    save:            'சேமி',
    cancel:          'ரத்து',
    delete:          'நீக்கு',
    edit:            'திருத்து',
    close:           'மூடு',
    submit:          'சமர்ப்பி',
    next:            'அடுத்து',
    previous:        'முந்தைய',
    resume:          'தொடர்',
    discard:         'நிராகரி',
    correct:         'சரியானது',
    wrong:           'தவறானது',
    score:           'மதிப்பெண்',
    accuracy:        'துல்லியம்',
    streak:          'தொடர்ச்சி',
    points:          'புள்ளிகள்',
  },
}

export const EXAM_OPTIONS = [
  { value: 'TNPSC Group 4',   label: 'TNPSC Group 4' },
  { value: 'TNPSC Group 2/2A',label: 'TNPSC Group 2/2A' },
  { value: 'TNPSC Group 1',   label: 'TNPSC Group 1' },
]

// ─── Context ─────────────────────────────────────────────────────────────────
const AppContext = createContext(null)

let _toastId = 0

export function AppProvider({ children }) {
  const { user, profile, refreshProfile } = useAuth()

  const [selectedExam, setSelectedExamState] = useState('TNPSC Group 4')
  const [language, setLanguageState]         = useState('en')
  const [toasts, setToasts]                  = useState([])
  const toastTimeouts = useRef({})

  // Sync from profile when it loads
  useEffect(() => {
    if (profile?.selected_exam)      setSelectedExamState(profile.selected_exam)
    if (profile?.preferred_language) setLanguageState(profile.preferred_language)
  }, [profile?.selected_exam, profile?.preferred_language])

  // Persist exam selection to Supabase profile
  const setSelectedExam = useCallback(async (exam) => {
    setSelectedExamState(exam)
    if (user?.id) {
      await supabase.from('profiles').update({ selected_exam: exam }).eq('id', user.id)
    }
  }, [user?.id])

  // Persist language to Supabase profile
  const setLanguage = useCallback(async (lang) => {
    setLanguageState(lang)
    if (user?.id) {
      await supabase.from('profiles').update({ preferred_language: lang }).eq('id', user.id)
    }
  }, [user?.id])

  // i18n helper
  const t = useCallback((key) => {
    return translations[language]?.[key] ?? translations['en'][key] ?? key
  }, [language])

  // ── Toast system ─────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, message, type }])
    toastTimeouts.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      delete toastTimeouts.current[id]
    }, duration)
    return id
  }, [])

  const removeToast = useCallback((id) => {
    clearTimeout(toastTimeouts.current[id])
    delete toastTimeouts.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error',   dur || 6000),
    info:    (msg, dur) => addToast(msg, 'info',    dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => Object.values(toastTimeouts.current).forEach(clearTimeout)
  }, [])

  return (
    <AppContext.Provider value={{
      selectedExam,
      setSelectedExam,
      language,
      setLanguage,
      t,
      toast,
      toasts,
      removeToast,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
