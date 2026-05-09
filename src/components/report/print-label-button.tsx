"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PrintLabelButton() {
  const handlePrint = () => {
    // Ensure canvas is rendered before print
    setTimeout(() => window.print(), 100)
  }

  return (
    <Button
      onClick={handlePrint}
      className="mt-4 w-full"
      variant="outline"
    >
      <Printer className="mr-2 h-4 w-4" />
      Print Label
    </Button>
  )
}
