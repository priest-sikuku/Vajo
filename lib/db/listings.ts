import { createClient } from "@/lib/supabase/server"

export async function createListing(
  sellerId: string,
  coinAmount: number,
  pricePerCoin: number,
  paymentMethods: string[],
) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("listings").insert({
    seller_id: sellerId,
    coin_amount: coinAmount,
    price_per_coin: pricePerCoin,
    payment_methods: paymentMethods,
    status: "active",
  })

  if (error) throw error
  return data
}

export async function getActiveListings() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("listings").select("*").eq("status", "active")

  if (error) throw error
  return data
}

export async function getUserListings(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("listings").select("*").eq("seller_id", userId)

  if (error) throw error
  return data
}

export async function updateListingStatus(listingId: string, status: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("listings").update({ status }).eq("id", listingId)

  if (error) throw error
  return data
}
