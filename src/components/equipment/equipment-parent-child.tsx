"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/status-badge"
import Link from "next/link"
import { ArrowRight, GitFork, Package } from "lucide-react"
import type { Equipment } from "@/lib/types"

interface Props {
  equipmentId: string
  parentId?: string | null
}

export function EquipmentParentChild({ equipmentId, parentId }: Props) {
  const [parent, setParent] = useState<Equipment | null>(null)
  const [children, setChildren] = useState<Equipment[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (parentId) {
      supabase
        .from("equipment")
        .select("*")
        .eq("id", parentId)
        .single()
        .then(({ data }) => setParent(data as Equipment | null))
    }

    supabase
      .from("equipment")
      .select("*")
      .eq("parent_id", equipmentId)
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => setChildren((data || []) as Equipment[]))
  }, [equipmentId, parentId, supabase])

  if (!parentId && children.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <GitFork className="h-4 w-4" />
          Asset Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {parent && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Parent Asset</p>
            <Link href={`/equipment/${parent.id}`} className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/50 transition-colors">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{parent.name}</p>
                <p className="text-xs text-muted-foreground">{parent.tag_number}</p>
              </div>
              <StatusBadge status={parent.status} />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Department and location are inherited from the parent asset.
            </p>
          </div>
        )}

        {children.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Child Assets ({children.length})
            </p>
            <div className="space-y-1">
              {children.map((child) => (
                <Link
                  key={child.id}
                  href={`/equipment/${child.id}`}
                  className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/50 transition-colors"
                >
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{child.name}</p>
                    <p className="text-xs text-muted-foreground">{child.tag_number}</p>
                  </div>
                  <StatusBadge status={child.status} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
