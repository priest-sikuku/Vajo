"use client"

import { Plus, History, FileText, Wallet, CheckCircle2, Shield, Star, ArrowLeftRight } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { useRouter } from 'next/navigation'
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { BalanceTransferModal } from "@/components/balance-transfer-modal"
import { GuestBanner } from "@/components/guest-banner"
import { AFRICAN_COUNTRIES } from "@/lib/countries"

interface Ad {
  id: string
  user_id: string
  ad_type: string
  afx_amount: number
  min_amount: number
  max_amount: number
  account_number: string | null
  mpesa_number: string | null
  paybill_number: string | null
  airtel_money: string | null
  terms_of_trade: string | null
  created_at: string
  profiles: {
    username: string | null
    email: string | null
    rating: number | null
  }
  remaining_amount?: number
  price_per_afx?: number
  country_code?: string
  currency_code?: string
}

interface UserStats {
  total_trades: number
  completed_trades: number
  completion_rate: number
  average_rating: number
  total_ratings: number
}

export default function P2PMarket() {
  const router = useRouter()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy")
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [p2pBalance, setP2pBalance] = useState<number>(0)
  const [dashboardBalance, setDashboardBalance] = useState<number>(0)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [initiatingTrade, setInitiatingTrade] = useState<string | null>(null)
  const [tradeAmounts, setTradeAmounts] = useState<{ [key: string]: string }>({})

  const [userStats, setUserStats] = useState<{ [key: string]: UserStats }>({})
  const [userCountry, setUserCountry] = useState<string | null>(null)
  const [userCurrency, setUserCurrency] = useState<string>("KES")

  const fetchBalance = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      if (!userCountry) setUserCountry("KE")
      setIsLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("country_code, currency_code")
      .eq("id", user.id)
      .single()

    if (profile) {
      setUserCountry(profile.country_code || "KE")
      setUserCurrency(profile.currency_code || "KES")
    } else {
      if (!userCountry) setUserCountry("KE")
    }

    // Fetch dashboard balance (coins table)
    const { data: coins } = await supabase
      .from("coins")
      .select("amount")
      .eq("user_id", user.id)
      .eq("status", "available")

    if (coins) {
      const totalDashboard = coins.reduce((sum, coin) => sum + Number(coin.amount), 0)
      setDashboardBalance(totalDashboard)
    }

    // Fetch P2P balance (trade_coins table)
    const { data: tradeCoins } = await supabase
      .from("trade_coins")
      .select("amount")
      .eq("user_id", user.id)
      .eq("status", "available")

    if (tradeCoins) {
      const totalP2P = tradeCoins.reduce((sum, coin) => sum + Number(coin.amount), 0)
      setP2pBalance(totalP2P)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    fetchBalance()
    getCurrentUser()
    const interval = setInterval(fetchBalance, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (userCountry) {
      fetchAds()
    }
  }, [activeTab, userCountry])

  async function getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)
  }

  async function fetchAds() {
    setLoading(true)
    try {
      const adType = activeTab === "buy" ? "sell" : "buy"
      
      const { data: tableData, error: tableError } = await supabase
        .from("p2p_ads")
        .select(`
          *,
          profiles:user_id (
            username,
            email,
            rating
          )
        `)
        .eq("ad_type", adType)
        .eq("country_code", userCountry || "KE")
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })

      if (tableError) {
        console.error("[v0] Error fetching ads:", tableError.message)
        return
      }

      setAds(tableData || [])

      if (tableData && tableData.length > 0) {
        const uniqueUserIds = [...new Set(tableData.map((ad) => ad.user_id))]
        await fetchUserStats(uniqueUserIds)
      }
    } catch (error) {
      console.error("[v0] Error:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUserStats(userIds: string[]) {
    const statsPromises = userIds.map(async (userId) => {
      const { data, error } = await supabase.rpc("get_user_p2p_stats", { p_user_id: userId }).single()

      if (error) {
        console.error(`[v0] Error fetching stats for user ${userId}:`, error)
        return { userId, stats: null }
      }

      return { userId, stats: data }
    })

    const results = await Promise.all(statsPromises)
    const statsMap: { [key: string]: UserStats } = {}

    results.forEach(({ userId, stats }) => {
      if (stats) {
        statsMap[userId] = stats
      }
    })

    setUserStats(statsMap)
  }

  async function initiateTrade(ad: Ad) {
    try {
      setInitiatingTrade(ad.id)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/auth/sign-in?next=/p2p&message=Please log in to start trading`)
        return
      }

      if (user.id === ad.user_id) {
        alert("You cannot trade with yourself")
        setInitiatingTrade(null)
        return
      }

      const customAmount = Number.parseFloat(tradeAmounts[ad.id] || "0")
      const tradeAmount = customAmount > 0 ? customAmount : ad.min_amount
      const availableAmount = ad.remaining_amount || ad.afx_amount

      if (tradeAmount < 2) {
        alert("Minimum trade amount is 2 AFX")
        setInitiatingTrade(null)
        return
      }

      if (tradeAmount > availableAmount) {
        alert(`Maximum available amount is ${availableAmount} AFX`)
        setInitiatingTrade(null)
        return
      }

      const { data: tradeId, error } = await supabase.rpc("initiate_p2p_trade_v2", {
        p_ad_id: ad.id,
        p_buyer_id: user.id,
        p_afx_amount: tradeAmount,
      })

      if (error) {
        console.error("[v0] Error initiating trade:", error)
        alert(error.message || "Failed to initiate trade")
        return
      }

      router.push(`/p2p/trade/${tradeId}`)
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("Failed to initiate trade")
    } finally {
      setInitiatingTrade(null)
    }
  }

  function getPaymentMethods(ad: Ad): { name: string; color: string }[] {
    const methods: { name: string; color: string }[] = []

    if (ad.mpesa_number) {
      methods.push({ name: "M-Pesa", color: "bg-green-500" })
    }
    if (ad.paybill_number) {
      methods.push({ name: "M-Pesa Paybill", color: "bg-yellow-500" })
    }
    if (ad.airtel_money) {
      methods.push({ name: "Airtel Money", color: "bg-red-500" })
    }

    if (ad.account_number) {
      const accountStr = ad.account_number.toLowerCase()

      if (accountStr.includes("m-pesa") && !ad.mpesa_number) {
        if (accountStr.includes("paybill")) {
          methods.push({ name: "M-Pesa Paybill", color: "bg-yellow-500" })
        } else {
          methods.push({ name: "M-Pesa", color: "bg-green-500" })
        }
      }
      if (accountStr.includes("bank") && !methods.some((m) => m.name.includes("Bank"))) {
        methods.push({ name: "Bank Transfer", color: "bg-blue-500" })
      }
      if (accountStr.includes("airtel") && !ad.airtel_money) {
        methods.push({ name: "Airtel Money", color: "bg-red-500" })
      }

      if (methods.length === 0 && ad.account_number.length > 0) {
        methods.push({ name: "Bank Transfer", color: "bg-blue-500" })
      }
    }

    return methods
  }

  function renderStarRating(rating: number) {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} size={12} className="fill-yellow-500 text-yellow-500" />)
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} size={12} className="fill-yellow-500/50 text-yellow-500" />)
      } else {
        stars.push(<Star key={i} size={12} className="text-gray-600" />)
      }
    }

    return stars
  }

  return (
    <div className="min-h-screen flex flex-col bg-black pb-20 md:pb-0">
      <Header />
      <GuestBanner />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">P2P Trading</h1>
            <p className="text-gray-400 text-sm">
              Trading in {userCountry ? AFRICAN_COUNTRIES[userCountry as keyof typeof AFRICAN_COUNTRIES]?.name : "..."} ({userCurrency})
            </p>
          </div>

          <div className="bg-[#1a1d24] rounded-xl p-4 mb-6 border border-white/5">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex gap-2">
                <Button
                  className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === "buy"
                      ? "bg-[#0ecb81] text-black hover:bg-[#0ecb81]/90"
                      : "bg-transparent text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                  onClick={() => setActiveTab("buy")}
                >
                  Buy
                </Button>
                <Button
                  className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === "sell"
                      ? "bg-[#f6465d] text-white hover:bg-[#f6465d]/90"
                      : "bg-transparent text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                  onClick={() => setActiveTab("sell")}
                >
                  Sell
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                  <Wallet size={18} className="text-[#0ecb81]" />
                  <span className="text-sm text-gray-400">P2P Balance:</span>
                  <span className="font-semibold text-white">{isLoading ? "..." : `${p2pBalance.toFixed(2)} AFX`}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowTransferModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
                >
                  <ArrowLeftRight size={16} className="mr-1" />
                  Transfer
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-sm"
                  onClick={() => router.push("/p2p/post-ad")}
                >
                  <Plus size={16} />
                  Post Ad
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-sm"
                  onClick={() => router.push("/p2p/my-ads")}
                >
                  <FileText size={16} />
                  My Ads
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-sm"
                  onClick={() => router.push("/p2p/my-trades")}
                >
                  <History size={16} />
                  My Trades
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0ecb81]" />
              <p className="text-gray-400 mt-4">Loading offers...</p>
            </div>
          ) : ads.length === 0 ? (
            <div className="text-center py-20 bg-[#1a1d24] rounded-xl border border-white/5">
              <p className="text-gray-400 mb-2">No {activeTab === "buy" ? "sell" : "buy"} offers available</p>
              <p className="text-sm text-gray-500">Be the first to post an ad!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ads.map((ad, index) => {
                const isPromoted = index === 0
                const stats = userStats[ad.user_id] || {
                  total_trades: 0,
                  completed_trades: 0,
                  completion_rate: 0,
                  average_rating: 0,
                  total_ratings: 0,
                }

                return (
                  <div
                    key={ad.id}
                    className={`bg-[#1a1d24] rounded-xl p-5 border transition-all hover:border-white/20 ${
                      isPromoted ? "border-yellow-500/50 shadow-lg shadow-yellow-500/10" : "border-white/5"
                    }`}
                  >
                    {isPromoted && (
                      <div className="mb-3 flex items-center gap-2">
                        <div className="bg-yellow-500/20 text-yellow-500 text-xs font-semibold px-2 py-1 rounded">
                          ⭐ PROMOTED
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-6">
                      <div className="flex-shrink-0 lg:w-48">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0ecb81] to-[#0ea76f] flex items-center justify-center text-white font-bold">
                            {(ad.profiles?.username || ad.profiles?.email || "A")[0].toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-white text-sm">
                                {ad.profiles?.username || ad.profiles?.email?.split("@")[0] || "Anonymous"}
                              </span>
                              <CheckCircle2 size={14} className="text-[#0ecb81]" />
                            </div>
                            {currentUserId === ad.user_id && (
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Your Ad</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <span>{stats.total_trades} trades</span>
                            <span className="text-gray-600">|</span>
                            <span className="text-[#0ecb81]">{stats.completion_rate.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex gap-0.5">{renderStarRating(stats.average_rating)}</div>
                            <span className="text-gray-400">
                              {stats.average_rating > 0 ? stats.average_rating.toFixed(1) : "No ratings"}
                            </span>
                            {stats.total_ratings > 0 && <span className="text-gray-600">({stats.total_ratings})</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 border-l border-white/5 pl-6">
                        <div className="mb-4">
                          <div className="text-2xl font-bold text-white mb-1">
                            {ad.currency_code || userCurrency} {ad.price_per_afx || "16.29"} <span className="text-base text-gray-400">/ AFX</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <div>
                              <span className="text-gray-500">Available </span>
                              <span className="text-white font-medium">{ad.remaining_amount || ad.afx_amount} AFX</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Limit </span>
                              <span className="text-white font-medium">
                                {ad.min_amount}-{ad.remaining_amount || ad.afx_amount} AFX
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="text-xs text-gray-500 mb-2">Payment</div>
                          <div className="flex flex-wrap gap-2">
                            {getPaymentMethods(ad).length > 0 ? (
                              getPaymentMethods(ad).map((method, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10"
                                >
                                  <div className={`w-2 h-2 rounded-full ${method.color}`} />
                                  <span className="text-xs text-gray-300">{method.name}</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-gray-500">No payment method selected</span>
                            )}
                          </div>
                        </div>

                        {ad.terms_of_trade && <div className="text-xs text-gray-400 italic">"{ad.terms_of_trade}"</div>}
                      </div>

                      <div className="flex-shrink-0 lg:w-56 flex flex-col justify-between gap-3">
                        {currentUserId !== ad.user_id && (
                          <>
                            <div>
                              <Label htmlFor={`amount-${ad.id}`} className="text-xs text-gray-400 mb-2 block">
                                Enter amount (AFX)
                              </Label>
                              <Input
                                id={`amount-${ad.id}`}
                                type="number"
                                min="2"
                                max={ad.remaining_amount || ad.afx_amount}
                                step="0.01"
                                placeholder={`${ad.min_amount}-${ad.remaining_amount || ad.afx_amount}`}
                                value={tradeAmounts[ad.id] || ""}
                                onChange={(e) => setTradeAmounts((prev) => ({ ...prev, [ad.id]: e.target.value }))}
                                className="bg-white/5 border-white/10 text-white h-10"
                              />
                            </div>
                            <Button
                              className={`w-full h-11 rounded-lg font-semibold transition-all ${
                                activeTab === "buy"
                                  ? "bg-[#0ecb81] text-black hover:bg-[#0ecb81]/90 hover:shadow-lg hover:shadow-[#0ecb81]/20"
                                  : "bg-[#f6465d] text-white hover:bg-[#f6465d]/90 hover:shadow-lg hover:shadow-[#f6465d]/20"
                              }`}
                              onClick={() => initiateTrade(ad)}
                              disabled={initiatingTrade === ad.id}
                            >
                              {initiatingTrade === ad.id
                                ? "Processing..."
                                : activeTab === "buy"
                                  ? "Buy AFX"
                                  : "Sell AFX"}
                            </Button>
                          </>
                        )}
                        {currentUserId === ad.user_id && (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <Shield size={24} className="text-blue-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-400">Your Ad</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />

      <BalanceTransferModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        dashboardBalance={dashboardBalance}
        p2pBalance={p2pBalance}
        onTransferComplete={fetchBalance}
      />
    </div>
  )
}
