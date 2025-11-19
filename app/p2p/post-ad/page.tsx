"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { ArrowLeft } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { AFRICAN_COUNTRIES, PAYMENT_GATEWAYS_BY_COUNTRY } from "@/lib/countries"
import { getUsdToLocalRate } from "@/lib/exchange-rates"

export default function PostAdPage() {
  const router = useRouter()
  const supabase = createClient()
  const [adType, setAdType] = useState<"buy" | "sell">("sell")
  const [loading, setLoading] = useState(false)
  const [currentAFXPrice, setCurrentAFXPrice] = useState<number>(0)
  
  const [userCountry, setUserCountry] = useState<string | null>(null)
  const [userCurrency, setUserCurrency] = useState<string>("KES")
  const [availablePaymentGateways, setAvailablePaymentGateways] = useState<any[]>([])

  const [formData, setFormData] = useState({
    afxAmount: "",
    pricePerAFX: "",
    minAmount: "",
    maxAmount: "",
    accountNumber: "",
    termsOfTrade: "",
  })

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("")
  const [selectedBuyMethods, setSelectedBuyMethods] = useState<string[]>([])
  const [paymentDetails, setPaymentDetails] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchUserAndPrice = async () => {
      const supabase = createClient()
      
      let currentUserCurrency = "KES"
      let currentUserCountry = "KE"

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("country_code, currency_code")
          .eq("id", user.id)
          .single()
        
        if (profile) {
          currentUserCountry = profile.country_code || "KE"
          currentUserCurrency = profile.currency_code || "KES"
          
          setUserCountry(currentUserCountry)
          setUserCurrency(currentUserCurrency)
          setAvailablePaymentGateways(PAYMENT_GATEWAYS_BY_COUNTRY[currentUserCountry as keyof typeof PAYMENT_GATEWAYS_BY_COUNTRY] || [])
        }
      }

      const { data, error } = await supabase
        .from("coin_ticks")
        .select("price")
        .order("tick_timestamp", { ascending: false })
        .limit(1)
        .single()

      if (!error && data) {
        const basePriceKES = Number(data.price)
        
        let localPrice = basePriceKES
        
        if (currentUserCurrency !== "KES") {
           const kesRate = await getUsdToLocalRate("KES")
           const targetRate = await getUsdToLocalRate(currentUserCurrency)
           localPrice = (basePriceKES / kesRate) * targetRate
        }

        setCurrentAFXPrice(Number(localPrice.toFixed(2)))
        setFormData((prev) => {
            if (prev.pricePerAFX === "" || prev.pricePerAFX === "0") {
                return { ...prev, pricePerAFX: localPrice.toFixed(2) }
            }
            return prev
        })
      } else {
        const { data: currentPrice } = await supabase.from("afx_current_price").select("price").single()

        const baseFallbackPrice = currentPrice?.price ? Number(currentPrice.price) : 13.0
        let localFallbackPrice = baseFallbackPrice

        if (currentUserCurrency !== "KES") {
            const kesRate = await getUsdToLocalRate("KES")
            const targetRate = await getUsdToLocalRate(currentUserCurrency)
            localFallbackPrice = (baseFallbackPrice / kesRate) * targetRate
        }

        setCurrentAFXPrice(Number(localFallbackPrice.toFixed(2)))
        setFormData((prev) => {
            if (prev.pricePerAFX === "" || prev.pricePerAFX === "0") {
                return { ...prev, pricePerAFX: localFallbackPrice.toFixed(2) }
            }
            return prev
        })
      }
    }

    fetchUserAndPrice()

    const interval = setInterval(fetchUserAndPrice, 5000)
    return () => clearInterval(interval)
  }, [])

  const minGlobalPriceUSD = 0.13
  const minAllowedPrice = (currentAFXPrice * 0.96).toFixed(2)
  const maxAllowedPrice = (currentAFXPrice * 1.04).toFixed(2)

  const validatePaymentDetails = () => {
    if (adType === "buy") {
      if (selectedBuyMethods.length === 0) {
        alert("Please select at least one payment method you support");
        return false;
      }
      return true;
    }

    if (!selectedPaymentMethod) {
      alert("Please select a payment method");
      return false;
    }

    const gateway = availablePaymentGateways.find(g => g.code === selectedPaymentMethod);
    if (!gateway) return false;

    for (const [fieldKey, fieldLabel] of Object.entries(gateway.fields)) {
      if (!paymentDetails[fieldKey]) {
        alert(`Please enter ${fieldLabel}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validatePaymentDetails()) {
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      if (Number.parseFloat(formData.afxAmount) < 5) {
        alert("Minimum amount to post an ad is 5 AFX")
        setLoading(false)
        return
      }

      const pricePerAFX = Number.parseFloat(formData.pricePerAFX)
      
      if (pricePerAFX < Number.parseFloat(minAllowedPrice) || pricePerAFX > Number.parseFloat(maxAllowedPrice)) {
        alert(`Price must be between ${minAllowedPrice} and ${maxAllowedPrice} ${userCurrency} (±4% of current price)`)
        setLoading(false)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert("Please sign in to post an ad")
        router.push("/auth/sign-in")
        return
      }

      if (adType === "sell") {
        const dbPaymentDetails: any = {
          p_user_id: user.id,
          p_afx_amount: Number.parseFloat(formData.afxAmount),
          p_price_per_afx: pricePerAFX,
          p_min_amount: Number.parseFloat(formData.minAmount),
          p_max_amount: Number.parseFloat(formData.maxAmount),
          p_payment_method: selectedPaymentMethod,
          p_terms_of_trade: formData.termsOfTrade || null,
        };

        if (selectedPaymentMethod.includes('mpesa')) {
           dbPaymentDetails.p_mpesa_number = paymentDetails.phone;
           dbPaymentDetails.p_full_name = paymentDetails.name;
           if (selectedPaymentMethod.includes('paybill')) {
             dbPaymentDetails.p_paybill_number = paymentDetails.paybill;
             dbPaymentDetails.p_account_number = paymentDetails.account;
           }
        } else if (selectedPaymentMethod.includes('airtel')) {
           dbPaymentDetails.p_airtel_number = paymentDetails.phone;
           dbPaymentDetails.p_full_name = paymentDetails.name;
        } else if (selectedPaymentMethod.includes('bank') || selectedPaymentMethod.includes('transfer')) {
           dbPaymentDetails.p_bank_name = paymentDetails.bank;
           dbPaymentDetails.p_account_number = paymentDetails.account;
           dbPaymentDetails.p_account_name = paymentDetails.name;
        } else {
           if (paymentDetails.phone) dbPaymentDetails.p_mpesa_number = paymentDetails.phone;
           if (paymentDetails.name) dbPaymentDetails.p_full_name = paymentDetails.name;
           if (paymentDetails.account) dbPaymentDetails.p_account_number = paymentDetails.account;
        }

        const { data, error } = await supabase.rpc("post_sell_ad_with_payment_details", dbPaymentDetails)

        if (error) {
          console.error("[v0] Error creating sell ad:", error)
          alert("Failed to create ad: " + error.message)
          return
        }

        alert("Sell ad posted successfully! Your coins have been locked for this ad.")
        router.push("/p2p")
      } else {
        const dbBuyDetails: any = {
          p_user_id: user.id,
          p_afx_amount: Number.parseFloat(formData.afxAmount),
          p_price_per_afx: pricePerAFX,
          p_min_amount: Number.parseFloat(formData.minAmount),
          p_max_amount: Number.parseFloat(formData.maxAmount),
          p_terms_of_trade: formData.termsOfTrade || null,
          p_country_code: userCountry || 'KE',
          p_currency_code: userCurrency || 'KES'
        };

        if (selectedBuyMethods.some(m => m.includes('mpesa'))) {
          dbBuyDetails.p_mpesa_number = 'Available';
        }
        if (selectedBuyMethods.some(m => m.includes('paybill'))) {
          dbBuyDetails.p_paybill_number = 'Available';
        }
        if (selectedBuyMethods.some(m => m.includes('airtel'))) {
          dbBuyDetails.p_airtel_number = 'Available';
        }
        if (selectedBuyMethods.some(m => m.includes('bank') || m.includes('transfer'))) {
          dbBuyDetails.p_account_number = 'Available';
        }

        const { data, error } = await supabase.rpc("post_buy_ad", dbBuyDetails)

        if (error) {
          console.error("[v0] Error creating buy ad:", error)
          alert("Failed to create buy ad: " + error.message)
          return
        }

        alert("Buy ad posted successfully!")
        router.push("/p2p")
      }
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("An error occurred while posting the ad")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Button variant="ghost" className="mb-6 hover:bg-white/5 transition" onClick={() => router.push("/p2p")}>
            <ArrowLeft size={20} className="mr-2" />
            Back to P2P Market
          </Button>

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Post an Ad</h1>
            <p className="text-gray-400">
              Create a buy or sell ad for AFX coins in {userCountry ? AFRICAN_COUNTRIES[userCountry as keyof typeof AFRICAN_COUNTRIES]?.name : "..."} ({userCurrency}) - Minimum: 5 AFX
            </p>
          </div>

          <form onSubmit={handleSubmit} className="glass-card p-8 rounded-xl border border-white/10 space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Ad Type</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setAdType("buy")}
                  className={`
                    relative h-20 rounded-lg border-2 transition-all duration-200
                    ${
                      adType === "buy"
                        ? "bg-green-500 border-green-400 shadow-lg shadow-green-500/50"
                        : "bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                    }
                  `}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className={`text-lg font-bold ${adType === "buy" ? "text-black" : "text-green-400"}`}>
                      BUY AFX
                    </span>
                    <span className={`text-xs ${adType === "buy" ? "text-black/70" : "text-green-400/70"}`}>
                      I want to buy AFX
                    </span>
                  </div>
                  {adType === "buy" && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAdType("sell")}
                  className={`
                    relative h-20 rounded-lg border-2 transition-all duration-200
                    ${
                      adType === "sell"
                        ? "bg-red-500 border-red-400 shadow-lg shadow-red-500/50"
                        : "bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
                    }
                  `}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className={`text-lg font-bold ${adType === "sell" ? "text-white" : "text-red-400"}`}>
                      SELL AFX
                    </span>
                    <span className={`text-xs ${adType === "sell" ? "text-white/70" : "text-red-400/70"}`}>
                      I want to sell AFX
                    </span>
                  </div>
                  {adType === "sell" && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="afxAmount">Amount of AFX * (Minimum: 5 AFX)</Label>
              <Input
                id="afxAmount"
                type="number"
                step="0.01"
                min="5"
                placeholder="Enter AFX amount (min 5)"
                value={formData.afxAmount}
                onChange={(e) => setFormData({ ...formData, afxAmount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricePerAFX">Price per AFX ({userCurrency}) *</Label>
              <Input
                id="pricePerAFX"
                type="number"
                step="0.01"
                min={minAllowedPrice}
                max={maxAllowedPrice}
                placeholder={`Between ${minAllowedPrice} - ${maxAllowedPrice} ${userCurrency}`}
                value={formData.pricePerAFX}
                onChange={(e) => setFormData({ ...formData, pricePerAFX: e.target.value })}
                required
              />
              <p className="text-xs text-gray-400">
                Current AFX price: {currentAFXPrice} {userCurrency}. Allowed range: {minAllowedPrice} - {maxAllowedPrice} {userCurrency} (±4%)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minAmount">Min Amount (AFX) * (Minimum: 1 AFX)</Label>
                <Input
                  id="minAmount"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="Minimum (min 1)"
                  value={formData.minAmount}
                  onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAmount">Max Amount (AFX) *</Label>
                <Input
                  id="maxAmount"
                  type="number"
                  step="0.01"
                  placeholder="Maximum"
                  value={formData.maxAmount}
                  onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Payment Methods</h3>

              {adType === "sell" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Payment Method for {userCurrency} *</Label>
                    <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                      <SelectTrigger className="w-full bg-white/5 border-white/10 h-12 px-4">
                        <SelectValue placeholder="Choose payment method" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d24] border-white/10">
                        {availablePaymentGateways.map((gateway) => (
                          <SelectItem key={gateway.code} value={gateway.code} className="text-white hover:bg-white/10 cursor-pointer py-3">
                            {gateway.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedPaymentMethod && (
                    <div className="space-y-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-sm text-gray-300">Fill in your {availablePaymentGateways.find(g => g.code === selectedPaymentMethod)?.name} details</p>
                      {availablePaymentGateways.find(g => g.code === selectedPaymentMethod)?.fields && 
                        Object.entries(availablePaymentGateways.find(g => g.code === selectedPaymentMethod)!.fields).map(([key, label]) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs text-gray-400">{label as string}</Label>
                            <Input 
                              value={paymentDetails[key] || ''}
                              onChange={(e) => setPaymentDetails({...paymentDetails, [key]: e.target.value})}
                              placeholder={`Enter ${label}`}
                              className="bg-black/20 border-white/10"
                            />
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Label>Select Payment Methods You Support *</Label>
                  <p className="text-sm text-gray-400 mb-2">Choose the methods you can use to pay sellers.</p>
                  <div className="grid grid-cols-1 gap-3">
                    {availablePaymentGateways.map((gateway) => (
                      <div 
                        key={gateway.code} 
                        className={`
                          flex items-center space-x-3 p-3 rounded-lg border transition-all
                          ${selectedBuyMethods.includes(gateway.code) 
                            ? "bg-green-500/10 border-green-500/50" 
                            : "bg-white/5 border-white/10 hover:bg-white/10"}
                        `}
                      >
                        <Checkbox 
                          id={`payment-${gateway.code}`}
                          checked={selectedBuyMethods.includes(gateway.code)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedBuyMethods([...selectedBuyMethods, gateway.code])
                            } else {
                              setSelectedBuyMethods(selectedBuyMethods.filter(m => m !== gateway.code))
                            }
                          }}
                          className="border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                        />
                        <label 
                          htmlFor={`payment-${gateway.code}`}
                          className="flex flex-col cursor-pointer flex-1"
                        >
                          <span className="font-medium text-white">{gateway.name}</span>
                          <span className="text-xs text-gray-400">{gateway.type.replace('_', ' ')}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="termsOfTrade">Terms of Trade</Label>
              <Textarea
                id="termsOfTrade"
                placeholder="Enter your terms and conditions for this trade..."
                rows={4}
                value={formData.termsOfTrade}
                onChange={(e) => setFormData({ ...formData, termsOfTrade: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-500 to-green-600 text-black hover:shadow-lg hover:shadow-green-500/50 transition"
              disabled={loading}
            >
              {loading ? "Posting Ad..." : "Post Ad"}
            </Button>
          </form>

          <div className="mt-8 glass-card p-8 rounded-xl border border-blue-500/30 bg-blue-500/10">
            <h3 className="font-bold text-white mb-4">Tips for Creating Successful Ads</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>Minimum posting amount: 5 AFX</li>
              <li>Minimum trade amount: 1 AFX</li>
              <li>Price must be within ±4% of current AFX price</li>
              <li>Set competitive prices to attract more traders</li>
              <li>Provide accurate payment details for smooth transactions</li>
              <li>Write clear terms to avoid misunderstandings</li>
              <li>Respond quickly to trade requests for better ratings</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
