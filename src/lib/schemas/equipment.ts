import { z } from "zod"

export const equipmentStatusEnum = z.enum(["active", "inactive", "retired", "under_repair"])

export const equipmentSchema = z.object({
  tag_number: z.string().min(1, "Tag number is required"),
  serial_number: z.string().optional(),
  name: z.string().min(1, "Equipment name is required"),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  status: equipmentStatusEnum.default("active"),
  category: z.string().optional(),
  install_date: z.string().optional(),
  warranty_expiry: z.string().optional(),
  notes: z.string().optional(),
})

export type EquipmentFormData = z.infer<typeof equipmentSchema>
