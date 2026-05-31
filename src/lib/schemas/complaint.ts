import { z } from "zod"

export const complaintReviewSchema = z.object({
  review_notes: z.string().min(5, "Review notes must be at least 5 characters").max(500, "Review notes must be under 500 characters"),
})
