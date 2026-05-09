import { z } from "zod"

export const commentSchema = z.object({
  work_order_id: z.string().uuid(),
  text: z.string().min(1, "Comment cannot be empty").max(2000, "Comment too long"),
})

export type CommentFormData = z.infer<typeof commentSchema>
