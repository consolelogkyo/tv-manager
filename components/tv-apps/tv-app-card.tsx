"use client";

import { ChevronDown, ChevronUp, ExternalLink, Lightbulb, Pencil, Star } from "lucide-react";
import { LicenseBadge, PriorityBadge } from "@/components/tv-apps/badges";
import { TvAppDeleteButton } from "@/components/tv-apps/tv-app-delete-button";
import { Button } from "@/components/ui/button";
import { isSafeHttpUrl } from "@/lib/tv-apps";
import type { PriorityDirection, TvApp } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  app: TvApp;
  position: number;
  onToggleFavorite: (app: TvApp) => void;
  onMove: (app: TvApp, direction: PriorityDirection) => void;
  onEdit: (app: TvApp) => void;
};

const POSITION_STYLES: Record<TvApp["priority"], string> = {
  1: "from-success/30 to-success/5 text-success ring-success/40",
  2: "from-sky-400/30 to-sky-400/5 text-sky-300 ring-sky-400/40",
  3: "from-muted to-muted/30 text-muted-foreground ring-border",
};

export function TvAppCard({ app, position, onToggleFavorite, onMove, onEdit }: Props) {
  // Revalida no render: só http(s) vira link (bloqueia javascript:/data: vindos do banco).
  const activationUrl = isSafeHttpUrl(app.activation_url) ? app.activation_url : null;

  return (
    <li
      className={cn(
        "group relative flex gap-3 rounded-xl border bg-background/40 p-3 transition-all duration-200 hover:border-primary/40 hover:bg-background/70 sm:p-4",
        app.is_favorite ? "border-warning/30 shadow-[0_0_0_1px] shadow-warning/10" : "border-border/60",
      )}
    >
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br font-display text-sm font-bold tabular-nums ring-1",
          POSITION_STYLES[app.priority],
        )}
        aria-label={`Posição ${position} na fila`}
        title={`Posição ${position} na fila`}
      >
        {position}º
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-display text-base font-semibold leading-tight">{app.app_name}</h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <PriorityBadge priority={app.priority} />
              <LicenseBadge info={app.license_info} />
            </div>
          </div>
          <button
            type="button"
            id={`tv-app-favorite-${app.id}`}
            onClick={() => onToggleFavorite(app)}
            aria-pressed={app.is_favorite}
            aria-label={app.is_favorite ? `Remover ${app.app_name} dos favoritos` : `Favoritar ${app.app_name}`}
            title={app.is_favorite ? "Remover dos favoritos" : "Marcar como favorito"}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg transition-all duration-200 cursor-pointer active:scale-90",
              app.is_favorite
                ? "text-warning hover:bg-warning/15"
                : "text-muted-foreground/60 hover:bg-muted hover:text-warning",
            )}
          >
            <Star
              className={cn(
                "size-5 transition-transform duration-300",
                app.is_favorite && "scale-110 fill-current drop-shadow-[0_0_6px_var(--warning)]",
              )}
            />
          </button>
        </div>

        {app.notes && (
          <p className="flex gap-1.5 rounded-lg bg-muted/40 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warning/80" />
            <span className="min-w-0 break-words">{app.notes}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          {activationUrl ? (
            <Button asChild variant="success" size="sm">
              <a
                id={`tv-app-activation-${app.id}`}
                href={activationUrl}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                <ExternalLink /> Abrir site de ativação
              </a>
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground/70">Sem link de ativação</span>
          )}

          <div className="flex items-center gap-0.5">
            <Button
              id={`tv-app-up-${app.id}`}
              variant="ghost"
              size="icon-sm"
              onClick={() => onMove(app, "up")}
              disabled={app.priority === 1}
              aria-label={`Subir prioridade de ${app.app_name}`}
              title="Subir prioridade"
              className="text-muted-foreground"
            >
              <ChevronUp />
            </Button>
            <Button
              id={`tv-app-down-${app.id}`}
              variant="ghost"
              size="icon-sm"
              onClick={() => onMove(app, "down")}
              disabled={app.priority === 3}
              aria-label={`Descer prioridade de ${app.app_name}`}
              title="Descer prioridade"
              className="text-muted-foreground"
            >
              <ChevronDown />
            </Button>
            <Button
              id={`tv-app-edit-${app.id}`}
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(app)}
              aria-label={`Editar ${app.app_name}`}
              title="Editar"
              className="text-muted-foreground hover:text-primary"
            >
              <Pencil />
            </Button>
            <TvAppDeleteButton app={app} />
          </div>
        </div>
      </div>
    </li>
  );
}
