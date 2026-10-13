import React, { useEffect, useState } from 'react'
import { useSimulatorStore } from '../store/useSimulatorStore'
import './Achievements.css'

const ACHIEVEMENTS = [
  { id: 'first_flight', name: 'Первый полет', description: 'Подняться на высоту 10м', condition: (state) => state.maxAltitude >= 10 },
  { id: 'high_flyer', name: 'Высокий полет', description: 'Подняться на высоту 50м', condition: (state) => state.maxAltitude >= 50 },
  { id: 'speed_demon', name: 'Скорость', description: 'Разогнаться до 50 км/ч', condition: (state) => state.speed >= 50 },
  { id: 'long_flight', name: 'Долгий полет', description: 'Лететь более 60 секунд', condition: (state) => state.flightTime >= 60 },
  { id: 'explorer', name: 'Исследователь', description: 'Пройдите дистанцию 500м', condition: (state) => state.distance >= 500 },
  { id: 'survivor', name: 'Выживший', description: 'Не разбиться 5 минут', condition: (state) => state.flightTime >= 300 && !state.isCrash },
]

function Achievements() {
  const [unlocked, setUnlocked] = useState(new Set())
  const [showNotification, setShowNotification] = useState(null)
  
  useEffect(() => {
    const checkAchievements = () => {
      const state = useSimulatorStore.getState()
      
      ACHIEVEMENTS.forEach(achievement => {
        if (!unlocked.has(achievement.id) && achievement.condition(state)) {
          // Разблокировано достижение!
          setUnlocked(prev => new Set([...prev, achievement.id]))
          setShowNotification(achievement)
          
          setTimeout(() => {
            setShowNotification(null)
          }, 3000)
        }
      })
    }
    
    const interval = setInterval(checkAchievements, 1000)
    return () => clearInterval(interval)
  }, [unlocked])
  
  if (!showNotification) return null
  
  return (
    <div className="achievement-notification">
      <div className="achievement-icon">🏆</div>
      <div className="achievement-content">
        <div className="achievement-title">Достижение разблокировано!</div>
        <div className="achievement-name">{showNotification.name}</div>
        <div className="achievement-description">{showNotification.description}</div>
      </div>
    </div>
  )
}

export default Achievements
