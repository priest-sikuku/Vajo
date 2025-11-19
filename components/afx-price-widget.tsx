"use client"

import { TrendingUp, TrendingDown, Activity, Wifi, WifiOff, DollarSign } from 'lucide-react'
import { useRealtimePrice } from "@/lib/hooks/use-realtime-price"
import { useExchangeRate, convertKEStoUSD } from "@/lib/hooks/use-exchange-rate"
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUsdToLocalRate } from '@/lib/exchange-rates'

export function AFXPriceWidget() {
  const { priceData, chartData, isConnected, priceChanged } = useRealtimePrice()
  const { exchangeRate } = useExchangeRate()
  const [userCurrency, setUserCurrency] = useState<string>("KES")
  const [localPrice, setLocalPrice] = useState<number>(0)
  const [currencySymbol, setCurrencySymbol] = useState<string>("KSh")

  useEffect(() => {
    const fetchUserCurrency = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('currency_code, currency_symbol')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setUserCurrency(profile.currency_code || "KES")
          setCurrencySymbol(profile.currency_symbol || "KSh")
        }
      }
    }
    fetchUserCurrency()
  }, [])

  useEffect(() => {
    const updateLocalPrice = async () => {
      if (userCurrency === 'KES') {
        setLocalPrice(priceData.price)
      } else {
        // Convert KES (base) to USD then to Local
        // We use the fixed rates from our new table for consistency
        const kesRate = await getUsdToLocalRate('KES')
        const targetRate = await getUsdToLocalRate(userCurrency)
        const usdPrice = priceData.price / kesRate
        setLocalPrice(usdPrice * targetRate)
      }
    }
    updateLocalPrice()
  }, [priceData.price, userCurrency])

  const isPositive = priceData.changePercent >= 0
  const priceUSD = convertKEStoUSD(priceData.price, exchangeRate.usd_to_kes)

  return (
    <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 shadow-lg shadow-cyan-500/10">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5 animate-pulse" />

      <div className="relative z-10 flex items-center justify-between gap-4">
        {/* Left: Price Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-cyan-400" />
            <p className="text-xs font-medium text-cyan-400/80 uppercase tracking-wider">AFX Price</p>
            {isConnected ? (
              <Wifi className="w-3 h-3 text-green-400 animate-pulse" />
            ) : (
              <div className="flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400">Offline</span>
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <p
              className={`text-2xl font-bold text-white tracking-tight transition-all duration-300 ${
                priceChanged ? "scale-110 text-cyan-400" : "scale-100"
              }`}
            >
              {localPrice.toFixed(2)}
            </p>
            <span className="text-xs text-gray-500">{userCurrency}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm text-gray-400">${priceUSD.toFixed(4)} USD</span>
            <span className="text-xs text-gray-600">
              (1 AFX = {localPrice.toFixed(2)} {currencySymbol})
            </span>
          </div>
        </div>

        {/* Middle: Mini Chart */}
        {chartData.length > 0 && (
          <div className="flex-1 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <YAxis domain={["dataMin", "dataMax"]} hide />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={isPositive ? "#10b981" : "#ef4444"}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={500}
                  animationEasing="ease-in-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Right: Stats */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span
              className={`text-sm font-bold transition-opacity duration-300 ${
                priceChanged ? "opacity-50" : "opacity-100"
              } ${isPositive ? "text-green-400" : "text-red-400"}`}
            >
              {isPositive ? "+" : ""}
              {priceData.changePercent.toFixed(2)}%
            </span>
          </div>
          <div className="text-xs text-gray-400">24h Change</div>
        </div>
      </div>
    </div>
  )
}
