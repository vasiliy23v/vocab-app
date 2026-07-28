import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * Generic notification/dialog shell used across the app instead of each
 * screen hand-rolling its own Dialog markup. Closes via the top-right X
 * (or Escape / outside click) when `onOpenChange` is given; omit it for a
 * dialog the user must act on before it can close (e.g. a required
 * first-time setup step) — no X renders and outside interactions are
 * inert, since there'd be nothing for them to fall back to.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  const dismissable = Boolean(onOpenChange)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-sm", className)}
        hideClose={!dismissable}
        onEscapeKeyDown={(e) => {
          if (!dismissable) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (!dismissable) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
