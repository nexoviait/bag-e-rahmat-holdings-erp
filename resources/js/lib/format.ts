export function fmtBDT(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return "৳0.00";
  return (
    "৳" +
    Number(amount).toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  user: "User",
};

export const statusLabels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};
