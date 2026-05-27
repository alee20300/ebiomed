import { getExpiringCertificates } from "@/lib/actions/certificates"
import { format, parseISO, differenceInDays } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { FileText, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export async function CertificateExpiryAlert() {
  const certs = await getExpiringCertificates(30)

  if (certs.length === 0) return null

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          Certificates Expiring Soon ({certs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {certs.slice(0, 5).map((cert) => {
          const daysLeft = differenceInDays(parseISO(cert.valid_until), new Date())
          const isExpired = daysLeft < 0
          const equipment = cert.equipment as Record<string, unknown> | null
          return (
            <div
              key={cert.id}
              className={cn(
                "flex items-center justify-between rounded-md border p-2 text-sm",
                isExpired ? "border-red-200 bg-red-50" : "border-amber-200 bg-white"
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
                      ? "bg-red-100 text-red-800"
                      : daysLeft <= 7
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
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
