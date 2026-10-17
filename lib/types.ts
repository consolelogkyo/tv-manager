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
