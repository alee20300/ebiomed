import { z } from "zod"

export const roleEnum = z.enum(["admin", "technician", "viewer"])

export const profileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1, "Name is required"),
  role: roleEnum,
  department: z.string().optional(),
  phone: z.string().optional(),
})

export const profileUpdateSchema = profileSchema.omit({ id: true }).partial()

export type Profile = z.infer<typeof profileSchema>
