"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Html5Qrcode } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, Keyboard, X } from "lucide-react"

function extractTag(decodedText: string) {
  if (decodedText.startsWith("http://") || decodedText.startsWith("https://")) {
    try {
      const url = new URL(decodedText)
      return url.searchParams.get("tag") || decodedText
    } catch {
      return decodedText
    }
  }

  return decodedText
}

export function TechnicianScanner() {
  const router = useRouter()
  const [mode, setMode] = useState<"idle" | "scan" | "manual">("idle")
  const [tagInput, setTagInput] = useState("")
  const [error, setError] = useState("")
  const scannerRef = useRef<Html5Qrcode | null>(null)

  const goToTag = (tag: string) => {
    const cleanTag = tag.trim()
    if (!cleanTag) return
    router.push(`/scan?tag=${encodeURIComponent(cleanTag)}`)
  }

  const startScanner = async () => {
    setMode("scan")
    setError("")

    try {
      const scanner = new Html5Qrcode("technician-barcode-reader")
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 160 } },
        (decodedText) => {
          scanner.stop().catch(() => {})
          scannerRef.current = null
          setMode("idle")
          goToTag(extractTag(decodedText))
        },
        () => {}
      )
    } catch {
      setError("Camera access failed. Enter the tag manually.")
      setMode("manual")
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {})
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

  return (
    <div className="space-y-5">
      {mode === "idle" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" onClick={startScanner} className="h-28 flex-col gap-2">
            <Camera className="h-7 w-7" />
            Scan Asset
          </Button>
          <Button size="lg" variant="outline" onClick={() => setMode("manual")} className="h-28 flex-col gap-2">
            <Keyboard className="h-7 w-7" />
            Enter Tag
          </Button>
        </div>
      )}

      {mode === "scan" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Point camera at the equipment code</p>
            <Button variant="ghost" size="sm" onClick={stopScanner}>
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          </div>
          <div id="technician-barcode-reader" className="mx-auto max-w-sm overflow-hidden rounded-lg" />
        </div>
      )}

      {mode === "manual" && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            goToTag(tagInput)
          }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <Label htmlFor="technician-tag">Equipment Tag</Label>
            <Button variant="ghost" size="sm" type="button" onClick={() => setMode("idle")}>
              <X className="mr-1 h-4 w-4" />
              Back
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              id="technician-tag"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="BM-001"
              className="font-mono text-lg"
              autoFocus
            />
            <Button type="submit" disabled={!tagInput.trim()}>
              Open
            </Button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
