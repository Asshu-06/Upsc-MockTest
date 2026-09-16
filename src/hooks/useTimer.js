import { useState, useEffect, useRef } from 'react'

/**
 * Custom hook for exam timer based on database startedAt timestamp
 * Prevents timer reset on browser refresh or navigation.
 */
export function useTimer(startedAt, durationMinutes, onExpire) {
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0)
  const [isExpired, setIsExpired] = useState(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (!startedAt || !durationMinutes) return

    const startTimeMs = new Date(startedAt).getTime()
    const totalDurationMs = durationMinutes * 60 * 1000
    const targetTimeMs = startTimeMs + totalDurationMs

    const updateTimer = () => {
      const nowMs = Date.now()
      const diffMs = targetTimeMs - nowMs
      const diffSec = Math.max(0, Math.floor(diffMs / 1000))

      setTimeLeftSeconds(diffSec)

      if (diffSec <= 0 && !isExpired) {
        setIsExpired(true)
        if (onExpireRef.current) {
          onExpireRef.current()
        }
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [startedAt, durationMinutes, isExpired])

  return {
    timeLeftSeconds,
    isExpired
  }
}
