"use client"

import { useMining } from "@/lib/hooks/use-mining"
import { FlatMiningProgress } from "./flat-mining-progress"
import { Loader2, Sparkles, TrendingUp, Users } from 'lucide-react'
import { Button } from "./ui/button"
import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import { createClient } from "@/lib/supabase/client"

export function MiningWidget() {
  const router = useRouter()
  const { canMine, timeRemaining, isClaiming, isLoading, handleClaim, miningConfig, boostedRate } = useMining()
  const [showSuccess, setShowSuccess] = useState(false)
  const [showCoinSplash, setShowCoinSplash] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const baseRate = boostedRate?.base_rate || miningConfig?.reward_amount || 0.15
  const referralCount = boostedRate?.referral_count || 0
  const boostPercentage = boostedRate?.boost_percentage || 0
  const finalRate = boostedRate?.final_rate || baseRate
  const intervalHours = miningConfig?.interval_hours || 5
  const totalTime = intervalHours * 60 * 60 * 1000

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
    }
    checkAuth()
  }, [])

  const onClaim = async () => {
    if (!isAuthenticated) {
      router.push("/auth/sign-in?next=/dashboard&action=mine")
      return
    }

    setShowCoinSplash(true)
    const result = await handleClaim()
    if (result?.success) {
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        setShowCoinSplash(false)
      }, 3000)
    }
  }

  if (isLoading) {
    return (
      <div className="glass-card p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900/50 to-gray-800/50">
        <div className="flex items-center justify-center h-[500px]">
          <Loader2 className="w-10 h-10 animate-spin text-green-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900/50 via-gray-800/50 to-gray-900/50 overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_50%)] animate-pulse-slow" />
        <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 left-1/4 w-32 h-32 bg-green-500/10 rounded-full blur-3xl animate-float-delayed" />
      </div>

      <div className="relative z-10 flex flex-col items-center space-y-5">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
            <h3 className="text-3xl font-bold bg-gradient-to-r from-green-400 via-yellow-400 to-green-500 bg-clip-text text-transparent">
              AFX Mining
            </h3>
            <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
          </div>
          <p className="text-base text-gray-300">
            Mine <span className="text-yellow-400 font-bold">{finalRate.toFixed(2)} AFX</span> every {intervalHours}{" "}
            hours
          </p>
        </div>

        {isAuthenticated && (
          <div className="w-full max-w-md glass-card p-4 rounded-xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-green-500/5">
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              <h4 className="text-base font-bold text-white">Your Mining Rate</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Base Rate:</span>
                <span className="text-sm font-semibold text-white">{baseRate.toFixed(2)} AFX</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  Referrals:
                </span>
                <span className="text-sm font-semibold text-purple-400">{referralCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Boost:</span>
                <span className="text-sm font-semibold text-green-400">+{boostPercentage.toFixed(0)}%</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-300">Final Rate:</span>
                <span className="text-xl font-bold text-yellow-400">{finalRate.toFixed(2)} AFX</span>
              </div>
            </div>
            {referralCount === 0 && (
              <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-300">
                  💡 Refer friends to boost your mining rate by 10% per referral!
                </p>
              </div>
            )}
          </div>
        )}

        <div className="w-full max-w-xl py-4">
          <FlatMiningProgress timeRemaining={timeRemaining} totalTime={totalTime} />
        </div>

        <div className="w-full max-w-md">
          {showSuccess ? (
            <div className="text-center py-5 space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-8 h-8 text-yellow-400 animate-spin" />
                <div className="text-2xl font-bold text-green-400 animate-bounce">+{finalRate.toFixed(2)} AFX</div>
                <Sparkles className="w-8 h-8 text-yellow-400 animate-spin" />
              </div>
              <div className="text-base text-white font-semibold">Successfully Claimed!</div>
              {boostPercentage > 0 && (
                <div className="text-sm text-green-400">Including +{boostPercentage}% referral boost! 🎉</div>
              )}
              <div className="text-sm text-gray-400">Next claim in {intervalHours} hours</div>
            </div>
          ) : (
            <Button
              onClick={onClaim}
              disabled={(!canMine || isClaiming) && isAuthenticated}
              size="lg"
              className={`w-full py-6 text-xl font-bold rounded-xl transition-all duration-300 ${
                canMine || !isAuthenticated
                  ? "bg-gradient-to-r from-green-500 via-yellow-500 to-green-600 hover:from-green-600 hover:via-yellow-600 hover:to-green-700 shadow-lg shadow-green-500/50 animate-pulse-slow"
                  : "bg-gradient-to-r from-gray-600 to-gray-700 cursor-not-allowed"
              }`}
            >
              {isClaiming ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : !isAuthenticated ? (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Login to Mine AFX
                </>
              ) : canMine ? (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Claim {finalRate.toFixed(2)} AFX Now!
                </>
              ) : (
                <>Mining in Progress...</>
              )}
            </Button>
          )}
        </div>

        <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
          <div className="glass-card p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-gray-400 mb-1">Current Reward</p>
            <p className="text-lg font-bold text-green-400">{finalRate.toFixed(2)} AFX</p>
            {boostPercentage > 0 && <p className="text-xs text-green-300 mt-1">+{boostPercentage}% boost</p>}
          </div>
          <div className="glass-card p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-gray-400 mb-1">Mining Interval</p>
            <p className="text-lg font-bold text-blue-400">{intervalHours}h</p>
          </div>
        </div>
      </div>

      {showCoinSplash && <CoinSplashOverlay />}
    </div>
  )
}

function CoinSplashOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-coin-splash"
          style={{
            left: "50%",
            top: "50%",
            animationDelay: `${i * 0.05}s`,
            transform: `rotate(${i * 18}deg)`,
          }}
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-600 shadow-lg flex items-center justify-center text-xs font-bold text-yellow-900 border-2 border-yellow-400">
            A
          </div>
        </div>
      ))}
    </div>
  )
}
