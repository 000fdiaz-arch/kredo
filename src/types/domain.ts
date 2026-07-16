export type ClientStatus = "current" | "interest_pending" | "late" | "no_movements" | "inactive";

export type SummaryCard = {
  label: string;
  value: string;
  helper?: string;
};
