# Public Fault Reporting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public (no-login) fault reporting flow where hospital staff scan an equipment barcode and submit a photo + description, which auto-creates a corrective work order.

**Architecture:** New `/report` public route with barcode scanner + fault form. Server action handles photo upload to Supabase Storage, work order creation, and equipment status update. Middleware updated to allow public access.

**Tech Stack:** html5-qrcode (barcode scanning), Supabase Storage (photo upload), existing Zod + Supabase patterns

---

## File Structure Map

```
src/
  app/
    report/
      page.tsx                        # Main report page (scanner + form)
      success/
        page.tsx                      # Success confirmation
    (app)/
      equipment/
        [id]/
          page.tsx                    # Modify: add barcode display
  components/
    report/
      fault-form.tsx                  # Fault report form (photo + description)
      barcode-scanner.tsx             # Camera barcode scanner + manual entry
      barcode-display.tsx             # SVG Code 128 barcode for equipment detail
  lib/
    actions/
      fault-report.ts                 # submitFaultReport server action
    schemas/
      fault-report.ts                 # Zod schema for fault report form
  proxy.ts                            # Modify: allow /report without auth
supabase/
  migrations/
    0003_fault_report_columns.sql     # Add reported_by_name, reported_by_department, issue_photo_url
```

---

## Migration SQL

### Task 1: Add work_orders columns + storage bucket

**Files:**
- Create: `supabase/migrations/0003_fault_report_columns.sql`

- [ ] **Step 1: Create migration**

```sql
ALTER TABLE ebiomed.work_orders ADD COLUMN IF NOT EXISTS reported_by_name text;
ALTER TABLE ebiomed.work_orders ADD COLUMN IF NOT EXISTS reported_by_department text;
ALTER TABLE ebiomed.work_orders ADD COLUMN IF NOT EXISTS issue_photo_url text;
```

- [ ] **Step 2: Push migration**

```bash
/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_movieflixdash-main psql -U postgres -d postgres -f /Users/aliabdulla/eBiomed/supabase/migrations/0003_fault_report_columns.sql
```

- [ ] **Step 3: Create Supabase Storage bucket** — via Supabase Studio http://localhost:54323
  - Bucket name: `fault-photos`
  - Public bucket: yes
  - File size limit: 10 MB
  - Allowed MIME types: image/jpeg, image/png, image/webp

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_fault_report_columns.sql && git commit -m "feat: add fault report columns to work_orders"
```

---

### Task 2: Zod schema for fault report

**Files:**
- Create: `src/lib/schemas/fault-report.ts`

- [ ] **Step 1: Create schema**

```typescript
import { z } from "zod"

export const faultReportSchema = z.object({
  equipment_id: z.string().uuid("Invalid equipment"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  reported_by_name: z.string().optional(),
  reported_by_department: z.string().optional(),
})

export type FaultReportFormData = z.infer<typeof faultReportSchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/schemas/fault-report.ts && git commit -m "feat: add fault report Zod schema"
```

---

### Task 3: Fault report server action

**Files:**
- Create: `src/lib/actions/fault-report.ts`

- [ ] **Step 1: Create action**

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { faultReportSchema } from "@/lib/schemas/fault-report"

export async function submitFaultReport(formData: FormData) {
  const supabase = await createClient()
  const raw = Object.fromEntries(formData)

  const parsed = faultReportSchema.safeParse(raw)
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ")
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(messages)}`)
  }

  const photo = formData.get("photo") as File | null
  if (!photo || photo.size === 0) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent("Photo is required")}`)
  }

  // Create work order first to get an ID for the photo path
  const { data: wo, error: woError } = await supabase
    .from("work_orders")
    .insert({
      equipment_id: parsed.data.equipment_id,
      type: "corrective",
      priority: "medium",
      status: "open",
      description: parsed.data.description,
      reported_by_name: parsed.data.reported_by_name || null,
      reported_by_department: parsed.data.reported_by_department || null,
    })
    .select("id, equipment_id")
    .single()

  if (woError || !wo) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(woError?.message || "Failed to create work order")}`)
  }

  // Upload photo
  const ext = photo.name.split(".").pop() || "jpg"
  const photoPath = `${wo.id}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from("fault-photos")
    .upload(photoPath, photo, { contentType: photo.type, upsert: true })

  if (uploadError) {
    return redirect(`/report?tag=${raw.equipment_tag || ""}&error=${encodeURIComponent(uploadError.message)}`)
  }

  const { data: { publicUrl } } = supabase.storage.from("fault-photos").getPublicUrl(photoPath)

  // Update WO with photo URL
  await supabase.from("work_orders").update({ issue_photo_url: publicUrl }).eq("id", wo.id)

  // Set equipment to under_repair
  await supabase.from("equipment").update({ status: "under_repair", updated_at: new Date().toISOString() }).eq("id", wo.equipment_id)

  revalidatePath("/dashboard")
  revalidatePath("/work-orders")
  revalidatePath(`/equipment/${wo.equipment_id}`)
  redirect(`/report/success?wo=${wo.id}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/fault-report.ts && git commit -m "feat: add fault report server action with photo upload"
```

---

### Task 4: Barcode scanner component

**Files:**
- Create: `src/components/report/barcode-scanner.tsx`

- [ ] **Step 1: Install html5-qrcode**

```bash
npm install html5-qrcode
```

- [ ] **Step 2: Create barcode scanner component**

```tsx
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
            <Button variant="ghost" size="sm" onClick={stopScanner}><X className="h-4 w-4 mr-1" /> Cancel</Button>
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
              <X className="h-4 w-4 mr-1" /> Back
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/report/barcode-scanner.tsx package.json package-lock.json && git commit -m "feat: add barcode scanner component with camera and manual entry"
```

---

### Task 5: Fault report form

**Files:**
- Create: `src/components/report/fault-form.tsx`

- [ ] **Step 1: Create fault form**

```tsx
"use client"

import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { submitFaultReport } from "@/lib/actions/fault-report"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle, Camera } from "lucide-react"
import type { Equipment } from "@/lib/types"

interface Props {
  equipment: Equipment
}

export function FaultForm({ equipment }: Props) {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  return (
    <form className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <input type="hidden" name="equipment_id" value={equipment.id} />
      <input type="hidden" name="equipment_tag" value={equipment.tag_number} />

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div>
            <p className="font-semibold">{equipment.name}</p>
            <p className="text-sm text-gray-500">Tag: {equipment.tag_number}</p>
            <p className="text-sm text-gray-500">{equipment.department} — {equipment.location}</p>
          </div>
          <StatusBadge status={equipment.status} className="ml-auto" />
        </CardContent>
      </Card>

      <div>
        <Label htmlFor="photo">Photo of Issue *</Label>
        <div className="mt-2">
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Preview" className="max-h-64 rounded-lg object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => setPhotoPreview(null)}
              >
                Remove
              </Button>
            </div>
          ) : (
            <label className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-primary">
              <Camera className="mb-2 h-8 w-8 text-gray-400" />
              <span className="text-sm text-gray-500">Tap to take photo</span>
              <input
                type="file"
                name="photo"
                accept="image/*"
                capture="environment"
                required
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setPhotoPreview(URL.createObjectURL(file))
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="description">Describe the Issue *</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          required
          minLength={10}
          placeholder="Describe what's wrong with the equipment..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="reported_by_name">Your Name (optional)</Label>
          <Input id="reported_by_name" name="reported_by_name" />
        </div>
        <div>
          <Label htmlFor="reported_by_department">Department (optional)</Label>
          <Input id="reported_by_department" name="reported_by_department" />
        </div>
      </div>

      <Button formAction={submitFaultReport} type="submit" className="w-full" size="lg">
        Submit Fault Report
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/fault-form.tsx && git commit -m "feat: add fault report form with photo upload"
```

---

### Task 6: Report page (public route)

**Files:**
- Create: `src/app/report/page.tsx`
- Create: `src/app/report/success/page.tsx`

- [ ] **Step 1: Create report page**

```tsx
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { BarcodeScanner } from "@/components/report/barcode-scanner"
import { FaultForm } from "@/components/report/fault-form"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

async function ReportContent({ tag }: { tag?: string }) {
  if (!tag) return <BarcodeScanner />

  const supabase = await createClient()
  const { data: equipment } = await supabase
    .from("equipment")
    .select("*")
    .eq("tag_number", tag)
    .single()

  if (!equipment) {
    return (
      <div className="space-y-6">
        <BarcodeScanner />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-800 font-medium">Equipment not found</p>
          <p className="text-red-600 text-sm mt-1">No equipment with tag &quot;{tag}&quot; exists.</p>
        </div>
      </div>
    )
  }

  return <FaultForm equipment={equipment as any} />
}

export default function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6 text-center">
          <Link href="/report" className="text-2xl font-bold text-primary">eBiomed</Link>
          <p className="text-sm text-gray-500 mt-1">Report Faulty Equipment</p>
        </div>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <ReportContentAsync tag={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}

// Workaround: pass searchParams through a client-resolved async wrapper
async function ReportContentAsync({
  tag,
}: {
  tag: Promise<{ tag?: string }>
}) {
  const params = await tag
  return <ReportContent tag={params.tag} />
}
```

Wait — there's a hydration issue with mixing async and client components. Let me restructure:

```tsx
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { BarcodeScanner } from "@/components/report/barcode-scanner"
import { FaultForm } from "@/components/report/fault-form"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

interface PageProps {
  searchParams: Promise<{ tag?: string; error?: string }>
}

async function EquipmentLookup({ tag }: { tag: string }) {
  const supabase = await createClient()
  const { data: equipment } = await supabase
    .from("equipment")
    .select("*")
    .eq("tag_number", tag)
    .single()

  if (!equipment) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-800">Equipment not found</p>
        <p className="mt-1 text-sm text-red-600">No equipment with tag &quot;{tag}&quot; exists.</p>
        <Link href="/report" className="mt-4 inline-block text-sm text-primary hover:underline">
          Scan another
        </Link>
      </div>
    )
  }

  return <FaultForm equipment={equipment as any} />
}

export default async function ReportPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tag = params.tag

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6 text-center">
          <Link href="/report" className="text-2xl font-bold text-primary">eBiomed</Link>
          <p className="mt-1 text-sm text-gray-500">Report Faulty Equipment</p>
        </div>

        {!tag ? (
          <BarcodeScanner />
        ) : (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <EquipmentLookup tag={tag} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create success page `src/app/report/success/page.tsx`**

```tsx
import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function ReportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ wo?: string }>
}) {
  const params = await searchParams
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <CardTitle className="text-xl">Fault Report Submitted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            A work order has been created and the biomedical team will be notified.
          </p>
          {params.wo && (
            <p className="font-mono text-sm text-gray-500">Work Order: {params.wo.slice(0, 8)}</p>
          )}
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline">
              <Link href="/report">Report Another</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create directories and files**

```bash
mkdir -p /Users/aliabdulla/eBiomed/src/app/report/success /Users/aliabdulla/eBiomed/src/components/report
# Create both page files
```

- [ ] **Step 4: Commit**

```bash
git add src/app/report/ src/components/report/ && git commit -m "feat: add public report page with scanner, form, and success"
```

---

### Task 7: Update middleware for public /report route

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Update middleware to allow /report without auth**

Edit `src/proxy.ts`, change `isAuthRoute` check:

```typescript
const isAuthRoute = url.pathname.startsWith("/login") || 
                     url.pathname.startsWith("/auth") ||
                     url.pathname.startsWith("/report")
```

- [ ] **Step 2: Commit**

```bash
git add src/proxy.ts && git commit -m "fix: allow public access to /report route"
```

---

### Task 8: Barcode display on equipment detail

**Files:**
- Create: `src/components/report/barcode-display.tsx`
- Modify: `src/app/(app)/equipment/[id]/page.tsx`

- [ ] **Step 1: Create barcode display component** — generates an SVG Code 128 barcode inline (no npm dependency)

```tsx
// src/components/report/barcode-display.tsx
// Uses JsBarcode to generate an SVG Code 128 barcode
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
```

Install: `npm install jsbarcode @types/jsBarcode`

- [ ] **Step 2: Add barcode to equipment detail page**

In `src/app/(app)/equipment/[id]/page.tsx`, add after the equipment header:

```tsx
import { BarcodeDisplay } from "@/components/report/barcode-display"

// Inside the page, after the tabs section, add:
<Card>
  <CardHeader>
    <CardTitle className="text-sm">Barcode</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col items-center">
    <BarcodeDisplay value={equipment.tag_number} />
    <p className="mt-2 text-xs text-gray-500">Scan to report a fault or print for equipment label</p>
  </CardContent>
</Card>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/report/barcode-display.tsx package.json package-lock.json src/app/\(app\)/equipment/\[id\]/page.tsx && git commit -m "feat: add barcode display to equipment detail page"
```

---

## Task Summary

| # | Task | Files |
|---|------|-------|
| 1 | Migration + storage bucket | 1 SQL file |
| 2 | Zod fault schema | 1 file |
| 3 | Fault report server action | 1 file |
| 4 | Barcode scanner component | 1 file + deps |
| 5 | Fault form component | 1 file |
| 6 | Report page + success page | 2 files |
| 7 | Middleware update | 1 file modify |
| 8 | Barcode display on equipment | 2 files |

**Total: ~8 tasks, ~1.5 hours**
