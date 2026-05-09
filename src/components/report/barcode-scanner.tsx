"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Html5Qrcode } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, Keyboard, X } from "lucide-react"

export function BarcodeScanner() {
  const router = useRouter()
  const [mode, setMode] = useState<"scan" | "manual" | "idle">("idle")
  const [tagInput, setTagInput] = useState("")
  const [error, setError] = useState("")
  const scannerRef = useRef<Html5Qrcode | null>(null)

  const startScanner = async () => {
    setMode("scan")
    setError("")
    try {
      const scanner = new Html5Qrcode("barcode-reader")
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (decodedText) => {
          scanner.stop()
          setMode("idle")
          // If the scanned text is a URL, extract the tag parameter
          if (decodedText.startsWith("http://") || decodedText.startsWith("https://")) {
            try {
              const url = new URL(decodedText)
              const tag = url.searchParams.get("tag")
              if (tag) {
                router.push(`/report?tag=${encodeURIComponent(tag)}`)
                return
              }
            } catch {
              // Not a valid URL, fall through to treat as tag
            }
          }
          router.push(`/report?tag=${encodeURIComponent(decodedText)}`)
        },
        () => {}
      )
    } catch {
      setError("Camera access denied. Use manual entry instead.")
      setMode("manual")
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop()
      scannerRef.current = null
    }
    setMode("idle")
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tagInput.trim()) return
    router.push(`/report?tag=${encodeURIComponent(tagInput.trim())}`)
  }

  return (
    <div className="space-y-6">
      {mode === "idle" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Button size="lg" onClick={startScanner} className="h-32 flex-col gap-2">
            <Camera className="h-8 w-8" />
            Scan Barcode
          </Button>
          <Button size="lg" variant="outline" onClick={() => setMode("manual")} className="h-32 flex-col gap-2">
            <Keyboard className="h-8 w-8" />
            Enter Tag Manually
          </Button>
        </div>
      )}

      {mode === "scan" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Point camera at barcode</p>
            <Button variant="ghost" size="sm" onClick={stopScanner}><X className="mr-1 h-4 w-4" /> Cancel</Button>
          </div>
          <div id="barcode-reader" className="mx-auto max-w-sm overflow-hidden rounded-lg" />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {mode === "manual" && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="tag">Equipment Tag Number</Label>
            <Button variant="ghost" size="sm" type="button" onClick={() => setMode("idle")}>
              <X className="mr-1 h-4 w-4" /> Back
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              id="tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g. BM-001"
              className="font-mono text-lg"
              autoFocus
            />
            <Button type="submit" disabled={!tagInput.trim()}>Go</Button>
          </div>
        </form>
      )}
    </div>
  )
}
