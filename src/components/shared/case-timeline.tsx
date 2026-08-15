import Link from "next/link"
import { BadgeCheck, Camera, ClipboardCheck, Clock3, MessageSquare, Package, PhoneCall, Wrench } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime } from "@/lib/utils/format"
import type { CaseTimelineEvent, CaseTimelineKind } from "@/lib/actions/case-timeline"

const icons: Record<CaseTimelineKind, typeof Clock3> = {
  report: PhoneCall,
  review: ClipboardCheck,
  work_order: Wrench,
  field_work: Clock3,
  parts: Package,
  evidence: Camera,
  comment: MessageSquare,
  closure: BadgeCheck,
}

export function CaseTimeline({ events }: { events: CaseTimelineEvent[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock3 className="h-5 w-5" />
          Case Timeline
        </CardTitle>
        <p className="text-sm text-muted-foreground">From the original complaint through service activity and closeout.</p>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timeline events recorded yet.</p>
        ) : (
          <ol className="relative ml-3 border-l border-border">
            {events.map((event) => {
              const Icon = icons[event.kind]
              return (
                <li key={event.id} className="relative pb-6 pl-7 last:pb-0">
                  <span className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full border bg-background text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      {event.href ? (
                        <Link href={event.href} className="font-medium hover:text-primary hover:underline">
                          {event.title}
                        </Link>
                      ) : (
                        <p className="font-medium">{event.title}</p>
                      )}
                      {event.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{event.description}</p>}
                      {event.actor && <p className="mt-1 text-xs text-muted-foreground">By {event.actor}</p>}
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={event.occurredAt}>
                      {formatDateTime(event.occurredAt)}
                    </time>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
