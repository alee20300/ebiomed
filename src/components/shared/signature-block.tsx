import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { ShieldCheck, PenTool, CheckCircle, Eye } from "lucide-react"

interface SignatureBlockProps {
  signatures: Array<{
    id: string
    meaning: "Verified" | "Calibrated" | "Approved" | "Reviewed"
    signed_at: string
    signer?: { full_name: string; role: string } | null
    signature_hash?: string | null
  }>
  compact?: boolean
}

const meaningIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Verified: CheckCircle,
  Calibrated: PenTool,
  Approved: ShieldCheck,
  Reviewed: Eye,
}

export function SignatureBlock({ signatures, compact = false }: SignatureBlockProps) {
  if (signatures.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No electronic signatures recorded.
      </p>
    )
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {signatures.map((sig) => {
        const Icon = meaningIcons[sig.meaning] || ShieldCheck
        return (
          <Card key={sig.id} className="border-muted">
            <CardContent className={compact ? "px-3 py-2" : "p-4"}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}>
                    Electronically signed by {sig.signer?.full_name || "Unknown"}
                  </p>
                  <p className={compact ? "text-[11px]" : "text-xs"}>
                    {format(new Date(sig.signed_at), "yyyy-MM-dd HH:mm:ss")}
                    {" — "}
                    <span className="font-medium">{sig.meaning}</span>
                  </p>
                  {sig.signer?.role && (
                    <p className={compact ? "text-[11px] text-muted-foreground" : "text-xs text-muted-foreground"}>
                      Role: {sig.signer.role}
                    </p>
                  )}
                  {sig.signature_hash && (
                    <p className={compact ? "mt-1 text-[9px] font-mono text-muted-foreground line-clamp-1" : "mt-1 text-[10px] font-mono text-muted-foreground line-clamp-1"}
                      title={sig.signature_hash}>
                      Hash: {sig.signature_hash.slice(0, compact ? 16 : 32)}...
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
