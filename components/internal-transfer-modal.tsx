"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Send, AlertCircle } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface InternalTransferModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: number
  onTransferComplete: () => void
}

export function InternalTransferModal({
  open,
  onOpenChange,
  balance,
  onTransferComplete,
}: InternalTransferModalProps) {
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleTransfer = async () => {
    if (!amount || Number(amount) < 50) {
      toast({
        title: "Invalid Amount",
        description: "Minimum transfer amount is 50 AFX",
        variant: "destructive",
      })
      return
    }

    if (!recipient) {
      toast({
        title: "Recipient Required",
        description: "Please enter a wallet address, email, or username",
        variant: "destructive",
      })
      return
    }

    if (Number(amount) > balance) {
      toast({
        title: "Insufficient Balance",
        description: `You don't have enough balance. Available: ${balance.toFixed(2)} AFX`,
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.rpc("transfer_internal", {
        p_recipient_address: recipient,
        p_amount: Number(amount),
      })

      if (error) throw error

      toast({
        title: "Transfer Successful",
        description: `Successfully sent ${amount} AFX to ${recipient}`,
      })

      setAmount("")
      setRecipient("")
      onTransferComplete()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Transfer error:", error)
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to process transfer",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Send AFX</DialogTitle>
          <DialogDescription>
            Transfer AFX coins to another user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200 text-xs">
              Minimum transfer amount is 50 AFX. Transfers are instant and irreversible.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="Wallet Address, Email, or Username"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (AFX)</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                min="50"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-gray-800 border-gray-700"
              />
              <Button
                variant="outline"
                onClick={() => setAmount(balance.toString())}
                className="border-gray-700 hover:bg-gray-800"
              >
                Max
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              Available: {balance.toFixed(2)} AFX
            </p>
          </div>

          <Button
            onClick={handleTransfer}
            disabled={loading || !amount || Number(amount) < 50 || !recipient}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              "Processing..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send AFX
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
