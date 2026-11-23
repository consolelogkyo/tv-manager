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

export function TvAppCard({ app, position, onToggleFavorite, onMove, onEdit }: Props) {
  // Revalida no render: só http(s) vira link (bloqueia javascript:/data: vindos do banco).
  const activationUrl = isSafeHttpUrl(app.activation_url) ? app.activation_url : null;

  return (
    <li
      className={cn(
        "flex gap-3 rounded-lg border border-border bg-background p-3 transition-colors duration-150 hover:border-primary/50 sm:p-4",
      )}
    >
      <div
        className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-card font-mono text-[13px] text-muted-foreground tabular-nums"
        aria-label={`Posição ${position} na fila`}
        title={`Posição ${position} na fila`}
      >
        {position}º
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-[15px] leading-tight font-medium">{app.app_name}</h4>
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
              "grid size-8 shrink-0 cursor-pointer place-items-center rounded-md transition-colors duration-150 hover:bg-muted active:scale-[0.97]",
              app.is_favorite ? "text-warning" : "text-subtle-foreground hover:text-foreground",
            )}
          >
            <Star
              className={cn(
                "size-4",
                app.is_favorite && "fill-current",
              )}
            />
          </button>
        </div>

        {app.notes && (
          <p className="flex gap-1.5 rounded-md bg-card px-2.5 py-2 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" strokeWidth={1.75} />
            <span className="min-w-0 break-words">{app.notes}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          {activationUrl ? (
            <Button asChild variant="outline" size="sm">
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
            <span className="text-[11px] text-subtle-foreground">Sem link de ativação</span>
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
              className="text-muted-foreground"
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
