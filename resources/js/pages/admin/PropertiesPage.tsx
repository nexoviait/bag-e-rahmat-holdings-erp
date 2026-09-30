import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, AdminNavTabs } from "@/components/AppShell";
import { useIsAdmin, useHasPermission } from "@/lib/session";
import { fmtBDT } from "@/lib/format";
import { Loader2, MapPin, UserRound } from "lucide-react";
import { StatusBadge, PropertyDetailModal } from "@/pages/MyPropertyPage";

const TYPE_LABELS: Record<string, string> = { land: "Land", flat: "Flat", building: "Building", other: "Other" };

export function PropertiesPage() {
  const isAdmin = useIsAdmin();
  const canViewAll = useHasPermission("properties.view_all");
  const [openId, setOpenId] = useState<number | null>(null);

  const properties = useQuery({
    queryKey: ["all-properties"],
    enabled: canViewAll,
    queryFn: async () => (await api.get("/properties?all=1")).data as any[],
  });

  if (!isAdmin) {
    return <div className="grid h-40 place-items-center text-muted-foreground">Admins only.</div>;
  }

  const list = properties.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Properties"
        description="Personal property records submitted by every user — private to each owner, visible here for oversight. Sell / Development requests are reviewed below."
      />
      <AdminNavTabs />

      {!canViewAll ? (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">Your role does not have permission to view this.</div>
      ) : properties.isLoading ? (
        <div className="noir-panel grid h-24 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
        </div>
      ) : list.length === 0 ? (
        <div className="noir-panel px-4 py-16 text-center text-muted-foreground">No properties submitted yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setOpenId(p.id)}
              className="noir-panel p-4 text-left transition hover:border-gold/50 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="h-3 w-3 shrink-0" />
                    <span className="truncate">{p.owner_name}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{p.location}</span>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="rounded-full bg-surface-2 px-2 py-0.5">{TYPE_LABELS[p.type] ?? p.type}</span>
                {p.estimated_value != null && <span>{fmtBDT(Number(p.estimated_value))}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {openId != null && <PropertyDetailModal propertyId={openId} onClose={() => setOpenId(null)} adminMode />}
    </>
  );
}
