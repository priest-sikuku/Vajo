"use server"

import { createClient } from "@/lib/supabase/server"
import { createTransaction } from "@/lib/db/transactions"

export async function getMiningConfig() {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_current_mining_reward").single()

  if (error) {
    console.error("[v0] Error fetching mining config:", error)
    // Fallback to default values
    return {
      reward_amount: 0.5,
      interval_hours: 5,
      halving_date: null,
      is_halved: false,
    }
  }

  return data
}

export async function getBoostedMiningRate(userId: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.rpc("compute_boosted_mining_rate", {
      p_user_id: userId,
    })

    if (error) {
      console.error("[v0] Error computing boosted rate:", error)
      // Fallback to base rate
      const config = await getMiningConfig()
      return {
        base_rate: config.reward_amount,
        referral_count: 0,
        boost_percentage: 0,
        final_rate: config.reward_amount,
      }
    }

    return data[0] || {
      base_rate: 0.15,
      referral_count: 0,
      boost_percentage: 0,
      final_rate: 0.15,
    }
  } catch (err) {
    console.error("[v0] Exception getting boosted rate:", err)
    const config = await getMiningConfig()
    return {
      base_rate: config.reward_amount,
      referral_count: 0,
      boost_percentage: 0,
      final_rate: config.reward_amount,
    }
  }
}

export async function claimMining() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    const miningConfig = await getMiningConfig()
    const boostedRate = await getBoostedMiningRate(user.id)
    const REQUESTED_MINING_AMOUNT = boostedRate.final_rate
    const MINING_INTERVAL_HOURS = miningConfig.interval_hours

    console.log("[v0] Mining with boosted rate:", {
      userId: user.id,
      baseRate: boostedRate.base_rate,
      referralCount: boostedRate.referral_count,
      boostPercentage: boostedRate.boost_percentage,
      finalRate: boostedRate.final_rate,
    })

    // Get user's mining status from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("last_mine, next_mine")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("[v0] Error fetching profile:", profileError)
      return { success: false, error: "Failed to fetch profile" }
    }

    // Check if user can mine
    const now = new Date()
    const nextMine = profile.next_mine ? new Date(profile.next_mine) : null

    if (nextMine && now < nextMine) {
      return {
        success: false,
        error: "Mining not available yet",
        nextMine: nextMine.toISOString(),
      }
    }

    const { data: supplyCheck, error: supplyError } = await supabase.rpc(
      "deduct_from_global_supply",
      { mining_amount: REQUESTED_MINING_AMOUNT }
    )

    if (supplyError) {
      console.error("[v0] Error checking global supply:", supplyError)
      return { success: false, error: "Failed to check global supply" }
    }

    const supplyResult = supplyCheck[0]
    if (!supplyResult.success) {
      return {
        success: false,
        error: supplyResult.message,
        supplyExhausted: true,
      }
    }

    const ACTUAL_MINING_AMOUNT = supplyResult.remaining

    console.log("[v0] Mining with supply check:", {
      userId: user.id,
      requestedAmount: REQUESTED_MINING_AMOUNT,
      actualAmount: ACTUAL_MINING_AMOUNT,
      boostedRate: boostedRate,
    })

    const newNextMine = new Date(now.getTime() + MINING_INTERVAL_HOURS * 60 * 60 * 1000)

    // Update profile with new mining times
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        last_mine: now.toISOString(),
        next_mine: newNextMine.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", user.id)

    if (updateError) {
      console.error("[v0] Error updating profile:", updateError)
      return { success: false, error: "Failed to update mining status" }
    }

    const { data: coinData, error: coinsError } = await supabase
      .from("coins")
      .insert({
        user_id: user.id,
        amount: ACTUAL_MINING_AMOUNT,
        claim_type: "mining",
        status: "available",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single()

    if (coinsError) {
      console.error("[v0] Error adding coins:", coinsError)
      return { success: false, error: "Failed to add coins to balance" }
    }

    console.log("[v0] Coins added successfully with boost:", coinData)

    try {
      const { error: commissionError } = await supabase.rpc("add_claim_commission", {
        p_referred_id: user.id,
        p_claim_amount: REQUESTED_MINING_AMOUNT,
        p_coin_id: coinData.id,
      })

      if (commissionError) {
        console.error("[v0] Error adding claim commission:", commissionError)
      }
    } catch (commissionError) {
      console.error("[v0] Exception adding claim commission:", commissionError)
    }

    // Log transaction with actual amount
    await createTransaction(
      user.id,
      "mining",
      ACTUAL_MINING_AMOUNT,
      `Mining reward claimed with ${boostedRate.boost_percentage}% referral boost (${boostedRate.referral_count} referrals)`,
    )

    console.log("[v0] Mining claimed successfully with boost:", {
      userId: user.id,
      requestedAmount: REQUESTED_MINING_AMOUNT,
      actualAmount: ACTUAL_MINING_AMOUNT,
      baseRate: boostedRate.base_rate,
      referralBoost: boostedRate.boost_percentage,
      nextMine: newNextMine.toISOString(),
      coinId: coinData.id,
    })

    return {
      success: true,
      amount: ACTUAL_MINING_AMOUNT,
      nextMine: newNextMine.toISOString(),
      balance: coinData.amount,
      miningConfig,
      boostedRate,
    }
  } catch (error) {
    console.error("[v0] Exception in claimMining:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function getMiningStatus() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    const miningConfig = await getMiningConfig()
    const boostedRate = await getBoostedMiningRate(user.id)

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("last_mine, next_mine")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("[v0] Error fetching mining status:", profileError)
      return { success: false, error: "Failed to fetch mining status" }
    }

    const now = new Date()
    const nextMine = profile.next_mine ? new Date(profile.next_mine) : now
    const canMine = now >= nextMine

    return {
      success: true,
      canMine,
      lastMine: profile.last_mine,
      nextMine: profile.next_mine,
      timeRemaining: canMine ? 0 : nextMine.getTime() - now.getTime(),
      miningConfig,
      boostedRate, // Include boost details in status
    }
  } catch (error) {
    console.error("[v0] Exception in getMiningStatus:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
