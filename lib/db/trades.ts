import { createClient } from "@/lib/supabase/server"

export async function createTrade(
  listingId: string,
  buyerId: string,
  sellerId: string,
  coinAmount: number,
  totalPrice: number,
  paymentMethod: string,
) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("trades").insert({
    listing_id: listingId,
    buyer_id: buyerId,
    seller_id: sellerId,
    coin_amount: coinAmount,
    total_price: totalPrice,
    payment_method: paymentMethod,
    status: "pending",
  })

  if (error) throw error
  return data
}

export async function getUserTrades(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("trades").select("*").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)

  if (error) throw error
  return data
}

export async function updateTradeStatus(
  tradeId: string,
  status: string,
  buyerConfirmed?: boolean,
  sellerConfirmed?: boolean,
) {
  const supabase = await createClient()
  const updateData: any = { status }
  if (buyerConfirmed !== undefined) updateData.buyer_confirmed = buyerConfirmed
  if (sellerConfirmed !== undefined) updateData.seller_confirmed = sellerConfirmed

  const { data, error } = await supabase.from("trades").update(updateData).eq("id", tradeId)

  if (error) throw error
  return data
}
