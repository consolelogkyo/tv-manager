import { BadgeCheck, CircleDollarSign, Crown, LifeBuoy, ListEnd, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { licenseKind, PRIORITY_META } from "@/lib/tv-apps";
import type { TvAppPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<TvAppPriority, string> = {
  1: "border-success/35 bg-success/12 text-success",
  2: "border-sky-400/35 bg-sky-400/12 text-sky-300",
  3: "border-border bg-muted/60 text-muted-foreground",
};

const PRIORITY_ICONS = { 1: Crown, 2: LifeBuoy, 3: ListEnd } as const;

export function PriorityBadge({ priority, className }: { priority: TvAppPriority; className?: string }) {
  const Icon = PRIORITY_ICONS[priority];
  const meta = PRIORITY_META[priority];
  return (
    <Badge variant="outline" className={cn(PRIORITY_STYLES[priority], className)} title={meta.hint}>
      <Icon />
      {meta.label}
      <span className="hidden font-normal opacity-75 sm:inline">· {meta.hint}</span>
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
        kind === "free" && "border-success/30 bg-success/10 text-success",
        kind === "paid" && "border-warning/30 bg-warning/10 text-warning",
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
