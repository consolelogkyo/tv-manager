import { BadgeCheck, CircleDollarSign, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { licenseKind, PRIORITY_META } from "@/lib/tv-apps";
import type { TvAppPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PriorityBadge({ priority, className }: { priority: TvAppPriority; className?: string }) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge variant="outline" className={cn("gap-1.5", className)} title={meta.hint}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", PRIORITY_DOT[priority])} />
      {meta.label}
      <span className="hidden font-normal text-subtle-foreground sm:inline">· {meta.hint}</span>
    </Badge>
  );
}

export function LicenseBadge({ info }: { info: string | null }) {
  if (!info) return null;
  const kind = licenseKind(info);
  const Icon = kind === "free" ? BadgeCheck : kind === "paid" ? CircleDollarSign : Tag;
  return (
    <Badge
      variant="outline"
      className={cn(
        kind === "free" && "text-success",
        kind === "paid" && "text-warning",
      )}
    >
      <Icon />
      {info}
    </Badge>
  );
}

/** Ponto colorido usado em selects/legendas. */
export const PRIORITY_DOT: Record<TvAppPriority, string> = {
  1: "bg-success",
  2: "bg-sky-400",
  3: "bg-muted-foreground",
};
