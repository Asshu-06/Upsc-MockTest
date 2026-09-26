import { useState, useEffect, useRef } from 'react'

/**
 * Simple countdown timer hook.
 * @param {number|null} initialSeconds - null means untimed
 * @param {boolean} active - whether to start counting
 * @returns {{ seconds, isRunning }}
 */
export function useCountdown(initialSeconds, active = true) {
  const [seconds, setSeconds] = useState(initialSeconds ?? 0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!active || initialSeconds === null) return

    setSeconds(initialSeconds)

    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [initialSeconds, active])

  return { seconds, isRunning: seconds > 0 }
}
