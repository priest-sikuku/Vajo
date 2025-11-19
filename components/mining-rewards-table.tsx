"use client"

import { useState, useEffect } from "react"
import { Coins, Calendar, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface MiningReward {
  id: string
  amount: number
  created_at: string
  status: string
}

export function MiningRewardsTable() {
  const [rewards, setRewards] = useState<MiningReward[]>([])
  const [loading, setLoading] = useState(true)
  const [totalMined, setTotalMined] = useState(0)

  const fetchMiningRewards = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // Fetch mining transactions
      const { data: miningData } = await supabase
        .from("transactions")
        .select("id, amount, created_at, status")
        .eq("user_id", user.id)
        .eq("type", "mining")
        .order("created_at", { ascending: false })
        .limit(20)

      if (miningData) {
        setRewards(miningData)
        const total = miningData.reduce((sum, reward) => sum + Number(reward.amount), 0)
        setTotalMined(total)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchMiningRewards()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMiningRewards, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="glass-card p-6 rounded-2xl border border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <Coins className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Mining Rewards</h3>
            <p className="text-sm text-gray-400">Your mining claim history</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Total Mined</p>
          <p className="text-2xl font-bold text-yellow-400">{totalMined.toFixed(2)} AFX</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-white/5 rounded-lg">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <p className="text-xs text-gray-400">Claims</p>
          </div>
          <p className="text-lg font-bold text-white">{rewards.length}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Coins className="w-4 h-4 text-yellow-400" />
            <p className="text-xs text-gray-400">Per Claim</p>
          </div>
          <p className="text-lg font-bold text-white">0.73 AFX</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Calendar className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-gray-400">Interval</p>
          </div>
          <p className="text-lg font-bold text-white">3 Hours</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
        </div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-12">
          <Coins className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No mining rewards yet</p>
          <p className="text-sm text-gray-500">Start mining to earn 0.73 AFX every 3 hours</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">#</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Date & Time</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((reward, index) => (
                <tr key={reward.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="py-3 px-4 text-sm text-gray-400">#{rewards.length - index}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="font-semibold text-yellow-400">+{Number(reward.amount).toFixed(2)} AFX</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-300">{formatDate(reward.created_at)}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                      {reward.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Note */}
      {rewards.length > 0 && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-300">
            💡 Mining rewards are automatically credited to your Dashboard Balance
          </p>
        </div>
      )}
    </div>
  )
}
