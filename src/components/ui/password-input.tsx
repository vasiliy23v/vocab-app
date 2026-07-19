import * as React from "react"
import { useTranslation } from "react-i18next"
import { Eye, EyeOff } from "lucide-react"
import { Input, type InputProps } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type PasswordInputProps = Omit<InputProps, "type">

/**
 * A password <Input> with a "show/hide" eye toggle button, so people can
 * check what they typed instead of guessing. Renders as type="password"
 * until toggled, then type="text" — same field, same name/id, just a
 * different rendering of the same value.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const { t } = useTranslation()
    const [visible, setVisible] = React.useState(false)

    return (
      <div className="relative">
        <Input type={visible ? "text" : "password"} className={cn("pr-9", className)} ref={ref} {...props} />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("common.hidePassword") : t("common.showPassword")}
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
