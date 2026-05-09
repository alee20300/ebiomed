"use client"

import { useEffect, useRef } from "react"
import QRCode from "qrcode"

export function QRCodeDisplay({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      })
    }
  }, [value])

  return <canvas ref={canvasRef} className="max-w-[200px]" />
}
