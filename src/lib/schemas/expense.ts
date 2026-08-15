import { z } from "zod"

export const expenseSchema = z.object({
  category: z.enum(["food", "ticket", "accommodation"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
})
