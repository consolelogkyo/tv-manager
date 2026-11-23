import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** `<select>` nativo com o mesmo visual do `Input` (acessível e ótimo no mobile). */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "flex h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-input bg-background py-2 pr-9 pl-3 text-base transition-[color,border-color] outline-none md:text-sm",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          "disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark] [&>option]:bg-popover [&>optgroup]:bg-popover",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle-foreground"
      />
    </div>
  );
}

export { NativeSelect };
