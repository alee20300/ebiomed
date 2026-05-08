"use client"

import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"

export function BarcodeDisplay({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        displayValue: true,
        fontSize: 14,
        height: 40,
        margin: 4,
      })
    }
  }, [value])

  return <svg ref={svgRef} className="w-full max-w-xs" />
}
