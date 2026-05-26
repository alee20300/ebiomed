"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface EquipmentResult {
  id: string
  name: string
  tag_number: string
  department: string | null
  status: string
}

export function EquipmentSearch() {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<EquipmentResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([])
      setShowDropdown(false)
      return
    }

    const timer = setTimeout(() => {
      supabase
        .from("equipment")
        .select("id, name, tag_number, department, status")
        .or(`name.ilike.%${query}%,tag_number.ilike.%${query}%`)
        .order("name")
        .limit(8)
        .then(({ data }) => {
          setResults((data || []) as EquipmentResult[])
          setShowDropdown(true)
        })
    }, 200)

    return () => clearTimeout(timer)
  }, [query, supabase])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const selectEquipment = (eq: EquipmentResult) => {
    setQuery("")
    setShowDropdown(false)
    router.push(`/equipment/${eq.id}`)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Search equipment by name or tag..."
          className="pl-9 bg-white"
        />
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg">
          {results.map((eq) => (
            <button
              key={eq.id}
              type="button"
              onClick={() => selectEquipment(eq)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
            >
              <div>
                <p className="text-sm font-medium">{eq.name}</p>
                <p className="text-xs text-gray-500">{eq.department || "No department"}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-gray-400">{eq.tag_number}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white p-4 text-center text-sm text-gray-500 shadow-lg">
          No equipment found
        </div>
      )}
    </div>
  )
}
