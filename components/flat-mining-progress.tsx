"use client"

import { useEffect, useState } from "react"
import { Clock } from 'lucide-react'

interface FlatMiningProgressProps {
  timeRemaining: number // milliseconds
  totalTime: number // milliseconds (5 hours = 18000000ms)
}

export function FlatMiningProgress({ timeRemaining, totalTime }: FlatMiningProgressProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Calculate progress (0-100)
    const percent = Math.max(0, Math.min(100, ((totalTime - timeRemaining) / totalTime) * 100))
    setProgress(percent)
  }, [timeRemaining, totalTime])

  // Determine current color based on progress
  const getBarColor = () => {
    if (progress < 25) return "from-blue-500 to-blue-600"
    if (progress < 50) return "from-green-500 to-green-600"
    if (progress < 75) return "from-yellow-500 to-yellow-600"
    return "from-red-500 to-red-600"
  }

  // Format time remaining
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const getStatusText = () => {
    if (progress < 25) return "Starting..."
    if (progress < 50) return "In Progress..."
    if (progress < 75) return "Almost There..."
    if (progress >= 100) return "Ready to Mine!"
    return "Getting Close..."
  }

  return (
    <div className="w-full space-y-2">
      {/* Progress bar */}
      <div className="w-full h-12 bg-black/30 rounded-xl border border-white/10 overflow-hidden backdrop-blur-sm relative">
        <div
          className={`h-full bg-gradient-to-r ${getBarColor()} transition-all duration-500 ease-out relative`}
          style={{ width: `${progress}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-white" />
            <span className="text-lg font-bold text-white">
              {formatTime(timeRemaining)}
            </span>
            <span className="text-sm text-gray-200">
              ({Math.round(progress)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Status text */}
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-300">{getStatusText()}</p>
      </div>
    </div>
  )
}
