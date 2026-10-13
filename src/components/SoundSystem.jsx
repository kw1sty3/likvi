import React, { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSimulatorStore } from '../store/useSimulatorStore'

// Система звуковых эффектов через Web Audio API
function SoundSystem() {
  const audioContextRef = useRef(null)
  const engineOscillatorRef = useRef(null)
  const gainNodeRef = useRef(null)
  const { throttle, speed, isCrash, soundEnabled } = useSimulatorStore()
  
  useEffect(() => {
    if (!soundEnabled) return
    
    // Инициализация Web Audio API
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      audioContextRef.current = new AudioContext()
      
      // Создаем gain node для управления громкостью
      gainNodeRef.current = audioContextRef.current.createGain()
      gainNodeRef.current.connect(audioContextRef.current.destination)
      
      // Создаем осциллятор для звука двигателя
      const oscillator = audioContextRef.current.createOscillator()
      const gain = audioContextRef.current.createGain()
      
      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(100, audioContextRef.current.currentTime)
      
      gain.gain.setValueAtTime(0, audioContextRef.current.currentTime)
      
      oscillator.connect(gain)
      gain.connect(gainNodeRef.current)
      
      oscillator.start()
      engineOscillatorRef.current = { oscillator, gain }
    } catch (error) {
      console.warn('Web Audio API не поддерживается', error)
    }
    
    return () => {
      if (engineOscillatorRef.current) {
        engineOscillatorRef.current.oscillator.stop()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [soundEnabled])
  
  useFrame(() => {
    if (!soundEnabled || !engineOscillatorRef.current || !audioContextRef.current) return
    
    const { oscillator, gain } = engineOscillatorRef.current
    const currentTime = audioContextRef.current.currentTime
    
    // Частота звука зависит от газа (throttle)
    const baseFreq = 100
    const throttleFreq = baseFreq + (throttle * 200) // 100-300 Hz
    oscillator.frequency.setValueAtTime(throttleFreq, currentTime)
    
    // Громкость зависит от газа и скорости
    const volume = throttle * 0.3 + (speed / 100) * 0.1
    gain.gain.setValueAtTime(Math.max(0, Math.min(0.5, volume)), currentTime)
    
    // Звук крушения
    if (isCrash && !crashPlayed) {
      playCrashSound()
      crashPlayed = true
    } else if (!isCrash) {
      crashPlayed = false
    }
  })
  
  let crashPlayed = false
  
  const playCrashSound = () => {
    if (!audioContextRef.current) return
    
    try {
      // Создаем короткий звук крушения
      const oscillator = audioContextRef.current.createOscillator()
      const gain = audioContextRef.current.createGain()
      
      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(50, audioContextRef.current.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(20, audioContextRef.current.currentTime + 0.3)
      
      gain.gain.setValueAtTime(0.5, audioContextRef.current.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.3)
      
      oscillator.connect(gain)
      gain.connect(audioContextRef.current.destination)
      
      oscillator.start()
      oscillator.stop(audioContextRef.current.currentTime + 0.3)
    } catch (error) {
      console.warn('Ошибка воспроизведения звука крушения', error)
    }
  }
  
  return null
}

export default SoundSystem
