import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-lg border border-sidebar-border/30 bg-card/90 px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className,
      )}
      ref={ref}
      {...props}
    />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
