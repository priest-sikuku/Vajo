"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Clock } from 'lucide-react'
import { createBrowserClient } from "@supabase/ssr"

export function HalvingCountdownWidget() {
  const [timeRemaining, setTimeRemaining] = useState<string>("")
  const [isVisible, setIsVisible] = useState(false)
  const [currentReward, setCurrentReward] = useState<number>(0.5)
  const [nextReward, setNextReward] = useState<number>(0.15)
  const [targetDate, setTargetDate] = useState<Date | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    async function fetchHalvingData() {
      const { data } = await supabase
        .from("mining_config")
        .select("halving_date, reward_amount, post_halving_reward")
        .single()

      if (data?.halving_date) {
        const halvingDate = new Date(data.halving_date)
        const now = new Date()

        if (data.reward_amount) setCurrentReward(data.reward_amount)
        if (data.post_halving_reward) setNextReward(data.post_halving_reward)
        
        setTargetDate(halvingDate)

        if (halvingDate > now) {
          setIsVisible(true)
          updateCountdown(halvingDate)
        } else {
          setIsVisible(false)
        }
      }
    }

    function updateCountdown(halvingDate: Date) {
      const now = new Date()
      const diff = halvingDate.getTime() - now.getTime()

      if (diff <= 0) {
        setIsVisible(false)
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`)
    }

    fetchHalvingData()

    const interval = setInterval(() => {
      if (targetDate) {
        updateCountdown(targetDate)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [targetDate])

  if (!isVisible) {
    return null
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-orange-500/20 rounded-lg">
          <Clock className="h-5 w-5 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground">Mining Halving Event</h3>
            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-500 text-xs font-medium rounded-full">Live</span>
          </div>
          <div className="text-2xl font-bold text-orange-500 mb-2 font-mono">{timeRemaining}</div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Current Reward:</span>
              <span className="font-semibold text-foreground">{currentReward} AFX / 5hrs</span>
            </div>
            <div className="flex items-center justify-between">
              <span>After Halving:</span>
              <span className="font-semibold text-orange-500">{nextReward} AFX / 5hrs</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
