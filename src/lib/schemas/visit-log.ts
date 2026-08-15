import { z } from "zod"

export const logVisitSchema = z.object({
  complaint_id: z.string().uuid("Invalid complaint"),
})

export type LogVisitFormData = z.infer<typeof logVisitSchema>
