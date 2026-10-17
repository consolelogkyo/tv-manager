import type { CustomerStatus } from "@/lib/date";
import type { Customer } from "@/lib/types";

export type EnrichedCustomer = Customer & {
  days: number;
  status: CustomerStatus;
};

export type StatusFilter = "all" | CustomerStatus;
