import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EquipmentForm } from "@/components/equipment/equipment-form"

export default function NewEquipmentPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/equipment">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">New Equipment</h2>
      </div>
      <div className="rounded-lg border bg-white p-6">
        <EquipmentForm />
      </div>
    </div>
  )
}
