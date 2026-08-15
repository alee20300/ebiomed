import { getExpiringCertificates } from "@/lib/actions/certificates"
import { format, parseISO, differenceInDays } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { FileText, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export async function CertificateExpiryAlert() {
  const certs = await getExpiringCertificates(30)

  if (certs.length === 0) return null

  return (
    <Card size="sm" className="border-warning bg-warning-subtle">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2 text-warning-strong">
          <AlertTriangle className="h-4 w-4" />
          Certificates Expiring Soon ({certs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {certs.slice(0, 5).map((cert) => {
          const daysLeft = differenceInDays(parseISO(cert.valid_until), new Date())
          const isExpired = daysLeft < 0
          const equipment = cert.equipment as { name?: string | null; tag_number?: string | null } | null
          return (
            <div
              key={cert.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border px-2 py-1.5 text-sm",
                isExpired ? "border-danger bg-danger-subtle" : "border-warning/40 bg-card"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Link href={`/equipment/${cert.equipment_id}`} className="font-medium hover:underline truncate">
                    {equipment?.name || cert.equipment_id.slice(0, 8)}
                  </Link>
                </div>
                <p className="ml-6 text-xs text-muted-foreground">
                  {equipment?.tag_number ? `Tag: ${equipment.tag_number} — ` : ""}
                  Cert: {cert.certificate_number}
                </p>
              </div>
              <div className="ml-3 shrink-0 text-right">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    isExpired
                      ? "bg-danger-subtle text-danger-strong"
                      : daysLeft <= 7
                        ? "bg-danger-subtle text-danger-strong"
                        : "bg-warning-subtle text-warning-strong"
                  )}
                >
                  {isExpired ? "EXPIRED" : `${daysLeft}d left`}
                </Badge>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {format(parseISO(cert.valid_until), "yyyy-MM-dd")}
                </p>
              </div>
            </div>
          )
        })}
        {certs.length > 5 && (
          <p className="text-center text-xs text-muted-foreground">
            +{certs.length - 5} more certificates expiring within 30 days
          </p>
        )}
      </CardContent>
    </Card>
  )
}
