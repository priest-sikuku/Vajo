"use client"

import { useEffect, useState } from "react"

interface CircularMiningCountdownProps {
  timeRemaining: number // in milliseconds
  totalTime?: number // in milliseconds (default 3 hours)
  size?: number
  strokeWidth?: number
}

export function CircularMiningCountdown({
  timeRemaining,
  totalTime = 3 * 60 * 60 * 1000, // 3 hours in milliseconds
  size = 200,
  strokeWidth = 12,
}: CircularMiningCountdownProps) {
  const [percentage, setPercentage] = useState(0)

  useEffect(() => {
    // Calculate percentage remaining (0-100)
    const percent = Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100))
    setPercentage(percent)
  }, [timeRemaining, totalTime])

  // Format time remaining
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  // Calculate opacity based on percentage (fades as time decreases)
  const opacity = 0.3 + (percentage / 100) * 0.7

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-700"
        />
        {/* Progress circle with fading effect */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-green-500 transition-all duration-1000 ease-linear"
          style={{ opacity }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-white">{Math.round(percentage)}%</div>
        <div className="text-xs text-gray-400 mt-1">{formatTime(timeRemaining)}</div>
      </div>
    </div>
  )
}
