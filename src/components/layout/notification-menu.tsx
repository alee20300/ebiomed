import Link from "next/link"
import { Bell, Check, Clock, Mail, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getShellNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ShellNotification,
} from "@/lib/actions/notifications"
import { cn } from "@/lib/utils"

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime()
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))

  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value))
}

type DeliveryBadgeVariant = "success" | "destructive" | "warning" | "outline"

function deliveryVariant(status: string): DeliveryBadgeVariant {
  if (status === "sent") return "success"
  if (status === "failed") return "destructive"
  if (status === "skipped") return "warning"
  return "outline"
}

function NotificationIcon({ notification }: { notification: ShellNotification }) {
  if (notification.source === "pm_escalation_notifications") {
    return <Wrench className="h-4 w-4" />
  }

  return <Mail className="h-4 w-4" />
}

function NotificationItem({ notification }: { notification: ShellNotification }) {
  const isUnread = !notification.readAt

  return (
    <div
      className={cn(
        "grid grid-cols-[1.75rem_1fr] gap-2 rounded-md p-2.5",
        isUnread ? "bg-primary/5" : "bg-transparent"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-7 items-center justify-center rounded-md border",
          isUnread ? "border-primary/20 bg-primary/10 text-primary" : "border-border text-muted-foreground"
        )}
      >
        <NotificationIcon notification={notification} />
      </div>
      <div className="min-w-0 space-y-1">
        <Link href={notification.href} className="block space-y-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">{notification.title}</p>
            {isUnread ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" /> : null}
          </div>
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.message}</p>
        </Link>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {relativeTime(notification.createdAt)}
            </span>
            <Badge variant={deliveryVariant(notification.deliveryStatus)} className="h-5 px-1.5 text-[0.68rem]">
              {notification.deliveryStatus}
            </Badge>
          </div>
          {isUnread ? (
            <form action={markNotificationRead}>
              <input type="hidden" name="source" value={notification.source} />
              <input type="hidden" name="id" value={notification.id} />
              <Button type="submit" variant="ghost" size="icon-xs" aria-label="Mark notification as read">
                <Check className="h-3 w-3" />
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export async function NotificationMenu() {
  const { notifications, unreadCount } = await getShellNotifications()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            className="relative"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.62rem] font-semibold leading-4 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[24rem] max-w-[calc(100vw-1rem)] p-0">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline" size="xs" disabled={unreadCount === 0}>
              Mark all read
            </Button>
          </form>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[26rem] overflow-y-auto p-1.5">
          {notifications.length > 0 ? (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <NotificationItem key={`${notification.source}-${notification.id}`} notification={notification} />
              ))}
            </div>
          ) : (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium">No notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">Request and PM alerts will appear here.</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
