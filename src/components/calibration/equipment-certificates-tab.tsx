"use client"

import { useState, useEffect } from "react"
import { getCertificates } from "@/lib/actions/certificates"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { statusColor } from "@/lib/utils/format"
import { FileText, Download, ExternalLink } from "lucide-react"
import { format, isPast, parseISO } from "date-fns"
import type { Certificate } from "@/lib/types"

interface Props {
  equipmentId: string
}

export function EquipmentCertificatesTab({ equipmentId }: Props) {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCertificates(equipmentId).then((data) => {
      setCertificates(data)
      setLoading(false)
    })
  }, [equipmentId])

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading certificates...</p>
  }

  if (certificates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No certificates issued. Complete a calibration to generate a certificate.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {certificates.map((cert) => {
        const isExpired = isPast(parseISO(cert.valid_until))
        const actualStatus = isExpired && cert.status === "valid" ? "expired" : cert.status

        return (
          <Card key={cert.id} className="border-muted">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">{cert.certificate_number}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Issued {format(parseISO(cert.issued_at), "yyyy-MM-dd HH:mm")}
                      {" by "}{cert.issuer?.full_name || "Unknown"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  statusColor(actualStatus),
                )}>
                  {actualStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <div>
                  <span className="font-medium">Valid Until:</span>{" "}
                  {format(parseISO(cert.valid_until), "yyyy-MM-dd")}
                </div>
                <div>
                  <span className="font-medium">Hash:</span>{" "}
                  <span className="font-mono text-[10px]" title={cert.audit_trail_hash}>
                    {cert.audit_trail_hash.slice(0, 16)}...
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/certificates/${cert.id}`}
                    target="_blank"
                    rel="noopener"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-xs")}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    Download PDF
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
