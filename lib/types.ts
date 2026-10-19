export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  mac_address: string;
  app_name: string | null;
  plan_value: number;
  expires_at: string; // YYYY-MM-DD
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export type RenewMode = "auto" | "from_expiry" | "from_today";

/** 1 = 1ª opção (alta) · 2 = reserva (média) · 3 = fim da fila (baixa) */
export type TvAppPriority = 1 | 2 | 3;

export type TvApp = {
  id: string;
  tv_brand: string;
  app_name: string;
  priority: TvAppPriority;
  is_favorite: boolean;
  license_info: string | null;
  activation_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Sugestão de app (deduplicada por nome) usada no formulário de clientes. */
export type AppSuggestion = {
  name: string;
  isFavorite: boolean;
  bestPriority: TvAppPriority;
  brands: string[];
};

export type PriorityDirection = "up" | "down";
