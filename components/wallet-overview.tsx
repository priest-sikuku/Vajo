"use client"

import { Send, Copy, Check } from 'lucide-react'
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { InternalTransferModal } from "@/components/internal-transfer-modal"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface WalletOverviewProps {
  balance: number
  onBalanceUpdate?: () => void
}

export function WalletOverview({ balance, onBalanceUpdate }: WalletOverviewProps) {
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchWalletAddress = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('id', user.id)
          .single()
        
        if (data?.wallet_address) {
          setWalletAddress(data.wallet_address)
        }
      }
    }

    fetchWalletAddress()
  }, [])

  const copyToClipboard = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      toast({
        title: "Copied",
        description: "Wallet address copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="mb-3">
          <p className="text-gray-400 text-xs mb-1">Wallet Address</p>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-gray-300 truncate flex-1">
              {walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}` : "Loading..."}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white flex-shrink-0"
              onClick={copyToClipboard}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        <Button
          onClick={() => setIsTransferOpen(true)}
          size="sm"
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 mt-auto"
        >
          <Send className="w-3 h-3 mr-2" />
          Send AFX
        </Button>
      </div>

      <InternalTransferModal 
        open={isTransferOpen}
        onOpenChange={setIsTransferOpen}
        balance={balance}
        onTransferComplete={() => {
          if (onBalanceUpdate) onBalanceUpdate()
        }}
      />
    </>
  )
}
