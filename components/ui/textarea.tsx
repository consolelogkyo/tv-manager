import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-base shadow-xs transition-[color,box-shadow,border-color] outline-none md:text-sm resize-y",
        "placeholder:text-muted-foreground focus-visible:border-primary/70 focus-visible:ring-[3px] focus-visible:ring-primary/20",
        "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
