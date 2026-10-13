import React from 'react'
import { useApp } from '../../contexts/AppContext'
import { InteractiveSyllabusPanel } from '../../components/tnpsc/InteractiveSyllabus'

export function SyllabusPage() {
  const { selectedExam } = useApp()

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      {/* Renders the full two-column Interactive Syllabus dashboard */}
      <InteractiveSyllabusPanel key={selectedExam} isModal={false} />
    </div>
  )
}

export default SyllabusPage
