"use client"

import { useState } from "react"
import Footer from "@/components/footer"
import { UserProfile } from "@/components/user-profile"
import { SecuritySettings } from "@/components/security-settings"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Profile() {
  const [activeTab, setActiveTab] = useState("profile")

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Account Settings</h1>
            <p className="text-gray-400">Manage your profile, security and referrals</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8 bg-white/5 border border-white/10">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="referral">Referrals</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <UserProfile />
            </TabsContent>

            <TabsContent value="security">
              <SecuritySettings />
            </TabsContent>

            <TabsContent value="referral">
              <div className="space-y-6">
                <div className="glass-card p-6 rounded-xl border border-white/10 bg-gradient-to-br from-green-500/10 to-blue-500/10">
                  <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                    Referral Mining Boost
                  </h3>
                  <p className="text-gray-300 mb-6">
                    Each successful referral increases your mining rate by 10%. The more friends you invite, the more AFX you mine!
                  </p>
                  <div className="bg-black/30 rounded-lg p-4 mb-4">
                    <div className="text-sm text-gray-400 mb-2">Mining Rate Formula</div>
                    <div className="font-mono text-green-400">
                      Rate = 0.15 × (1 + Referrals × 0.10)
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">0 Referrals</div>
                      <div className="text-xl font-bold">0.15 AFX</div>
                    </div>
                    <div>
                      <div className="text-gray-400">10 Referrals</div>
                      <div className="text-xl font-bold text-green-400">0.30 AFX</div>
                    </div>
                    <div>
                      <div className="text-gray-400">50 Referrals</div>
                      <div className="text-xl font-bold text-blue-400">0.90 AFX</div>
                    </div>
                    <div>
                      <div className="text-gray-400">100 Referrals</div>
                      <div className="text-xl font-bold text-purple-400">1.65 AFX</div>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-6 rounded-xl border border-white/10">
                  <h3 className="text-xl font-bold mb-4">How Referrals Work</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        1
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Share Your Link</h4>
                        <p className="text-sm text-gray-400">Copy your referral link and share it with friends</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        2
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">They Sign Up</h4>
                        <p className="text-sm text-gray-400">Each successful signup boosts your mining rate by 10%</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        3
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">You Mine More</h4>
                        <p className="text-sm text-gray-400">Your increased mining rate applies to every mining cycle automatically</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  )
}
