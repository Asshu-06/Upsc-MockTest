import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../contexts/AppContext'
import { cn } from '../../lib/utils'

const SUGGESTIONS = [
  'What topics should I focus on today?',
  'Give me a study tip for Tamil Nadu history',
  'How many questions should I attempt daily?',
  'Explain the difference between Group 1 and Group 4',
]

/**
 * AI Copilot — floating chat button + panel.
 * Uses a rule-based context-aware response engine (no external API needed).
 * Can be wired to any LLM API endpoint when available.
 */
export function AICopilot() {
  const { profile } = useAuth()
  const { selectedExam, t } = useApp()

  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: `Hi ${profile?.full_name?.split(' ')[0] ?? 'there'}! 👋 I'm your Vina AI Mentor. Ask me anything about your ${selectedExam} preparation!`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  function buildContextualReply(question) {
    const q = question.toLowerCase()
    if (q.includes('topic') || q.includes('focus') || q.includes('study')) {
      return `For **${selectedExam}**, I recommend focusing on:\n• General Studies (History, Polity, Geography)\n• General Science (Physics, Chemistry, Biology)\n• Aptitude & Mental Ability\n\nBased on most candidates, **Indian Polity** and **Current Affairs** give the best return on study time.`
    }
    if (q.includes('tip') || q.includes('strategy')) {
      return `Here's a proven strategy for **${selectedExam}**:\n1. Revise NCERT basics first\n2. Attempt at least 1 mock test per week\n3. Use Quick Recall daily to build your streak\n4. Review your incorrect answers carefully\n5. Track your syllabus progress here in the app`
    }
    if (q.includes('group 1') || q.includes('group 4') || q.includes('group 2')) {
      return `**TNPSC Group Comparison:**\n• **Group 4**: VAO & Clerical posts, 10th/12th level, easiest entry\n• **Group 2/2A**: Intermediate & Graduation level, Sub-Inspector & similar\n• **Group 1**: Graduation level, District Collector & senior IAS-equivalent posts — hardest`
    }
    if (q.includes('daily') || q.includes('how many') || q.includes('schedule')) {
      return `Recommended daily schedule:\n• **Morning**: 20–30 questions (Quick Recall + PYQ)\n• **Afternoon**: 1 unit of syllabus revision\n• **Evening**: Current affairs (15 min)\n• **Weekly**: 1 full mock test\n\nConsistency beats intensity. Even 2 hours daily is enough if focused.`
    }
    if (q.includes('current affairs') || q.includes('news')) {
      return `Current Affairs tips for ${selectedExam}:\n• Focus on Tamil Nadu government schemes\n• Track TNPSC announcements\n• Read the Hindu/Indian Express for national events\n• Pay attention to new policies, appointments, and awards\n\nUse the **Current Affairs** section in the app to stay updated!`
    }
    return `That's a great question about **${selectedExam}** preparation! Here's my advice:\n\nFocus on the fundamentals first — complete your syllabus coverage, then layer in PYQ practice and mock tests. Use your Analytics page to identify weak areas and target them specifically.\n\nIs there a specific subject or topic you'd like me to elaborate on?`
  }

  async function handleSend(text) {
    const msg = (text ?? input).trim()
    if (!msg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)
    // Simulate thinking delay
    await new Promise(r => setTimeout(r, 900))
    const reply = buildContextualReply(msg)
    setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    setLoading(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Render markdown-like bold
  function renderText(text) {
    const parts = text.split(/\*\*(.*?)\*\*/g)
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    )
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-[900] w-14 h-14 rounded-full shadow-brand flex items-center justify-center transition-all duration-300',
          open ? 'bg-slate-700 rotate-0' : 'bg-tnpsc-brand hover:bg-tnpsc-brand-hover hover:scale-105'
        )}
        aria-label="AI Mentor"
      >
        {open ? <ChevronDown className="w-6 h-6 text-white" /> : <Sparkles className="w-6 h-6 text-white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[900] w-80 sm:w-96 bg-white rounded-2xl shadow-modal border border-surface-border flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-tnpsc-brand text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-bold">Vina AI Mentor</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/20 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-72">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line',
                  m.role === 'user'
                    ? 'bg-tnpsc-brand text-white rounded-br-sm'
                    : 'bg-slate-100 text-body-text rounded-bl-sm'
                )}>
                  {renderText(m.text)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-tnpsc-brand" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.slice(0, 2).map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-[10px] bg-tnpsc-brand-light text-tnpsc-brand rounded-full px-2.5 py-1 hover:bg-tnpsc-brand hover:text-white transition-colors font-medium"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-1">
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything…"
                className="flex-1 bg-transparent text-xs text-body-text outline-none placeholder-body-secondary"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg bg-tnpsc-brand text-white flex items-center justify-center disabled:opacity-40 hover:bg-tnpsc-brand-hover transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
