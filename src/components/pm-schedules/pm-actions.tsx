"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScheduleModal } from "@/components/schedules/schedule-modal"
import { Plus } from "lucide-react"

export function PMActions({ isViewer }: { isViewer: boolean }) {
  const [showModal, setShowModal] = useState(false)

  if (isViewer) return null

  return (
    <>
      <Button onClick={() => setShowModal(true)}>
        <Plus className="mr-1 h-4 w-4" />
        New PM Schedule
      </Button>
      <ScheduleModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}
