import { useCallback, useEffect, useRef } from 'react'

const CONTROL_KEYS = new Set(['KeyQ', 'KeyE', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'])

export function useKeyboardControls({ fpv = false } = {}) {
  const pressed = useRef({})
  const taps = useRef({})
  // Network packets are less frequent than keyboard events. Preserve a short
  // tap until one packet has sampled it, without extending a held key forever.
  pressed.readWithTaps = useCallback(() => {
    const keys = { ...taps.current, ...pressed.current }
    taps.current = {}
    return keys
  }, [])
  useEffect(() => {
    const clear = () => { pressed.current = {}; taps.current = {} }
    const down = event => {
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (!CONTROL_KEYS.has(event.code) && !(fpv && ['Space', 'KeyH'].includes(event.code))) return
      event.preventDefault()
      pressed.current[event.code] = true
      taps.current[event.code] = true
    }
    const up = event => { delete pressed.current[event.code] }
    const visibility = () => { if (document.hidden) clear() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      clear()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [fpv])
  return pressed
}
