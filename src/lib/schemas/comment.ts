import { z } from "zod"

export const commentSchema = z.object({
  work_order_id: z.string().uuid(),
  text: z.string().min(1, "Comment cannot be empty").max(2000, "Comment too long"),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
})

export type CommentFormData = z.infer<typeof commentSchema>
