import { getAssetDocuments, uploadAssetDocument } from "@/lib/actions/equipment"
import { formatDate, formatDateTime } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { FileText, Upload } from "lucide-react"

interface Props {
  equipmentId: string
}

function formatDocumentType(value: string) {
  return value.replaceAll("_", " ")
}

export async function EquipmentDocumentsTab({ equipmentId }: Props) {
  const documents = await getAssetDocuments(equipmentId)

  return (
    <div className="space-y-6">
      <form action={uploadAssetDocument.bind(null, equipmentId)} className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
        <div>
          <Label htmlFor="title">Document Title</Label>
          <Input id="title" name="title" required />
        </div>
        <div>
          <Label htmlFor="document_type">Type</Label>
          <Select name="document_type" defaultValue="manual">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="certificate">Certificate</SelectItem>
              <SelectItem value="purchase_doc">Purchase Document</SelectItem>
              <SelectItem value="photo">Photo</SelectItem>
              <SelectItem value="warranty_doc">Warranty Document</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="expires_at">Expiry Date</Label>
          <Input id="expires_at" name="expires_at" type="date" />
        </div>
        <div>
          <Label htmlFor="retention_policy">Retention Policy</Label>
          <Select name="retention_policy" defaultValue="standard_7_years">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="standard_7_years">Standard 7 Years</SelectItem>
              <SelectItem value="asset_life_plus_7">Asset Life + 7 Years</SelectItem>
              <SelectItem value="permanent">Permanent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="retain_until">Retain Until</Label>
          <Input id="retain_until" name="retain_until" type="date" />
        </div>
        <div>
          <Label htmlFor="file">File</Label>
          <Input id="file" name="file" type="file" required />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input id="legal_hold" name="legal_hold" type="checkbox" className="h-4 w-4" />
          <Label htmlFor="legal_hold">Legal Hold</Label>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="legal_hold_reason">Legal Hold Reason</Label>
          <Input id="legal_hold_reason" name="legal_hold_reason" />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Retention</TableHead>
            <TableHead>Uploaded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.id}>
              <TableCell>
                <a href={document.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
                  <FileText className="h-4 w-4" />
                  {document.title}
                </a>
                <p className="text-xs text-muted-foreground">{document.file_name || "Uploaded file"}</p>
              </TableCell>
              <TableCell className="capitalize">{formatDocumentType(document.document_type)}</TableCell>
              <TableCell>{formatDate(document.expires_at)}</TableCell>
              <TableCell>
                <span className="capitalize">{formatDocumentType(document.retention_policy)}</span>
                <p className="text-xs text-muted-foreground">
                  {document.legal_hold ? `Legal hold: ${document.legal_hold_reason || "Yes"}` : `Retain until ${formatDate(document.retain_until)}`}
                </p>
              </TableCell>
              <TableCell>
                {formatDateTime(document.created_at)}
                <p className="text-xs text-muted-foreground">{document.uploader?.full_name || "Unknown"}</p>
              </TableCell>
            </TableRow>
          ))}
          {documents.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No asset documents uploaded yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
