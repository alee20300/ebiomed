import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-3 py-1 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground [a]:hover:bg-muted/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive [a]:hover:bg-destructive/20 focus-visible:ring-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-background [a]:hover:text-foreground",
        success:
          "bg-[oklch(58%_0.16_145)]/10 text-[oklch(40%_0.15_145)] [a]:hover:bg-[oklch(58%_0.16_145)]/20",
        warning:
          "bg-[oklch(75%_0.18_85)]/10 text-[oklch(50%_0.18_85)] [a]:hover:bg-[oklch(75%_0.18_85)]/20",
        info:
          "bg-[oklch(70%_0.15_230)]/10 text-[oklch(50%_0.15_230)] [a]:hover:bg-[oklch(70%_0.15_230)]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
