import { z } from "zod"

export const appSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
})
