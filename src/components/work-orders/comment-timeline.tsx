"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { addComment } from "@/lib/actions/comments"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, MessageSquare } from "lucide-react"
import { formatRelative } from "@/lib/utils/format"
import type { WoComment } from "@/lib/types"

interface Props {
  workOrderId: string
}

export function CommentTimeline({ workOrderId }: Props) {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const [comments, setComments] = useState<WoComment[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .schema("ebiomed")
      .from("wo_comments")
      .select("*, author:author_id(full_name, role)")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setComments((data || []) as unknown as WoComment[]))
  }, [workOrderId, supabase])

  return (
    <div className="space-y-4">
      <h4 className="font-medium flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Comments ({comments.length})
      </h4>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <form action={addComment} className="space-y-3">
        <input type="hidden" name="work_order_id" value={workOrderId} />
        <Textarea
          name="text"
          rows={2}
          required
          maxLength={2000}
          placeholder="Add a comment..."
        />
        <Button type="submit" size="sm">
          Post Comment
        </Button>
      </form>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-md border bg-white p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {comment.author?.full_name || "Unknown"}
                </span>
                <span className="capitalize text-muted-foreground/60">
                  ({comment.author?.role})
                </span>
                <span className="ml-auto">{formatRelative(comment.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{comment.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
