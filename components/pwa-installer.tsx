"use client"

import { useEffect, useState } from "react"
import { X, Download } from 'lucide-react'

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[AFX] Service Worker registered:", registration)
          })
          .catch((error) => {
            console.error("[AFX] Service Worker registration failed:", error)
          })
      })
    }

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      console.log("[AFX] Install prompt available")
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    const timer = setTimeout(() => {
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallPrompt(true)
      }
    }, 3000)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert("To install AfriX:\n\niOS: Tap Share → Add to Home Screen\nAndroid: Tap Menu → Install App")
      return
    }

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log("[AFX] User choice:", outcome)

    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  if (!showInstallPrompt) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-slide-up">
      <div className="bg-gradient-to-br from-green-600/95 to-yellow-500/95 backdrop-blur-lg border border-green-400/30 rounded-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-1">Install AfriX App</h3>
            <p className="text-sm text-white/90">
              Install AfriX on your device for faster access and offline support
            </p>
          </div>
          <button
            onClick={() => setShowInstallPrompt(false)}
            className="text-white/60 hover:text-white transition"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <button
          onClick={handleInstall}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-white text-green-700 font-semibold py-2.5 px-4 rounded-lg hover:bg-green-50 transition"
        >
          <Download size={18} />
          Install App
        </button>
      </div>
    </div>
  )
}
