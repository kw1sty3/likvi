import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSimulatorStore } from '../store/useSimulatorStore'

function SoundSystem() {
  const engineRef = useRef(null)
  const crashPlayed = useRef(false)
  const soundEnabled = useSimulatorStore(state => state.soundEnabled)

  useEffect(() => {
    if (!soundEnabled) return
    let context, oscillator, gain
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      context = new AudioContext()
      oscillator = context.createOscillator()
      gain = context.createGain()
      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(100, context.currentTime)
      gain.gain.setValueAtTime(0, context.currentTime)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      engineRef.current = { context, oscillator, gain }
      crashPlayed.current = false
    } catch (error) {
      console.warn('Web Audio API недоступен', error)
    }
    return () => {
      engineRef.current = null
      oscillator?.stop()
      oscillator?.disconnect()
      gain?.disconnect()
      if (context && context.state !== 'closed') void context.close()
    }
  }, [soundEnabled])

  useFrame(() => {
    const engine = engineRef.current
    if (!engine) return
    const { throttle, speed, isCrash } = useSimulatorStore.getState()
    const { context, oscillator, gain } = engine, now = context.currentTime
    oscillator.frequency.setValueAtTime(100 + throttle * 200, now)
    gain.gain.setValueAtTime(Math.max(0, Math.min(0.5, throttle * 0.3 + speed / 1000)), now)
    if (!isCrash) { crashPlayed.current = false; return }
    if (crashPlayed.current) return
    crashPlayed.current = true
    const crash = context.createOscillator(), volume = context.createGain()
    crash.type = 'sawtooth'
    crash.frequency.setValueAtTime(50, now)
    crash.frequency.exponentialRampToValueAtTime(20, now + 0.3)
    volume.gain.setValueAtTime(0.5, now)
    volume.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    crash.connect(volume)
    volume.connect(context.destination)
    crash.onended = () => { crash.disconnect(); volume.disconnect() }
    crash.start()
    crash.stop(now + 0.3)
  })
  return null
}

export default SoundSystem
