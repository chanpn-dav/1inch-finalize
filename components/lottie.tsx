"use client"

import { useEffect, useRef } from "react"
import lottie, { type AnimationItem } from "lottie-web"

interface LottieProps {
  animationData: any
  loop?: boolean
  autoplay?: boolean
}

export function Lottie({ animationData, loop = true, autoplay = true }: LottieProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<AnimationItem | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    animationRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop,
      autoplay,
      animationData,
    })

    return () => {
      animationRef.current?.destroy()
    }
  }, [animationData, loop, autoplay])

  return <div ref={containerRef} className="h-full w-full" />
}
