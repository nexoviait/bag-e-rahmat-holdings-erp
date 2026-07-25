import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, AdminNavTabs } from "@/components/AppShell";
import { useIsAdmin } from "@/lib/session";
import { toast } from "sonner";
import { Sliders, Upload, Loader2, Image as ImageIcon, Save, Check } from "lucide-react";

export function SettingsPage() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();

  const [appName, setAppName] = useState("Bag E Rahmat");
  const [appSubtitle, setAppSubtitle] = useState("Holdings ERP");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const res = await api.get("/settings");
      return res.data;
    },
  });

  useEffect(() => {
    if (settings) {
      if (settings.app_name) setAppName(settings.app_name);
      if (settings.app_subtitle) setAppSubtitle(settings.app_subtitle);
      if (settings.app_logo) setLogoPreview(settings.app_logo);
      if (settings.app_favicon) setFaviconPreview(settings.app_favicon);
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("app_name", appName);
      formData.append("app_subtitle", appSubtitle);

      if (logoFile) {
        formData.append("logo", logoFile);
      }
      if (faviconFile) {
        formData.append("favicon", faviconFile);
      }

      const res = await api.post("/admin/settings", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("System settings updated successfully");
      if (data?.settings?.app_favicon) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "shortcut icon";
          document.head.appendChild(link);
        }
        link.href = data.settings.app_favicon;
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  if (!isAdmin) {
    return <div className="grid h-40 place-items-center text-muted-foreground">Admins only.</div>;
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaviconFile(file);
      setFaviconPreview(URL.createObjectURL(file));
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration / Settings"
        title="Workspace Settings"
        description="Configure dynamic product branding, application title, custom logo, and favicon."
      />

      <AdminNavTabs />

      <div className="noir-panel p-6 max-w-4xl">
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground">Loading system settings...</div>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings.mutate();
            }}
            className="space-y-8"
          >
            {/* Branding Section */}
            <div className="border-b border-border/60 pb-6">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2 mb-1">
                <Sliders className="h-5 w-5 text-gold" />
                Product Branding & Title
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Update the dynamic name and subtitle displayed across the header, sidebar, login screen, and page titles.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Application / Product Name
                  </label>
                  <input
                    className="pi"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="e.g. Bag E Rahmat"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    App Subtitle / Badge
                  </label>
                  <input
                    className="pi"
                    value={appSubtitle}
                    onChange={(e) => setAppSubtitle(e.target.value)}
                    placeholder="e.g. Holdings ERP"
                  />
                </div>
              </div>
            </div>

            {/* Logo & Favicon Uploads */}
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Logo Upload Box */}
              <div className="noir-panel p-5 border-border/80">
                <label className="mb-2 block font-display text-base font-semibold">
                  Upload Product Logo
                </label>
                <p className="text-xs text-muted-foreground mb-4">
                  Upload a custom brand logo image (PNG, SVG, JPG - Max 5MB). When uploaded, shows logo only and hides product name/subtitle text.
                </p>

                <div className="flex items-center gap-4 mb-4">
                  <div className="grid h-16 w-16 place-items-center rounded-xl border border-border bg-surface-2 overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo Preview" className="h-full w-full object-contain p-1" />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-md bg-gradient-to-br from-gold to-gold-soft text-primary-foreground font-display text-lg font-bold">
                        {appName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-1.5 text-xs font-medium text-foreground hover:border-gold hover:text-gold cursor-pointer transition">
                      <Upload className="h-4 w-4" />
                      <span>{logoFile ? logoFile.name : "Choose Logo File"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                    <div className="mt-1 text-[11px] text-muted-foreground">Recommended: 200x50px transparent PNG</div>
                  </div>
                </div>
              </div>

              {/* Favicon Upload Box */}
              <div className="noir-panel p-5 border-border/80">
                <label className="mb-2 block font-display text-base font-semibold">
                  Upload Favicon
                </label>
                <p className="text-xs text-muted-foreground mb-4">
                  Upload custom browser tab icon (ICO, PNG, SVG - Max 2MB).
                </p>

                <div className="flex items-center gap-4 mb-4">
                  <div className="grid h-16 w-16 place-items-center rounded-xl border border-border bg-surface-2 overflow-hidden">
                    {faviconPreview ? (
                      <img src={faviconPreview} alt="Favicon Preview" className="h-8 w-8 object-contain" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-gold" />
                    )}
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-1.5 text-xs font-medium text-foreground hover:border-gold hover:text-gold cursor-pointer transition">
                      <Upload className="h-4 w-4" />
                      <span>{faviconFile ? faviconFile.name : "Choose Favicon File"}</span>
                      <input
                        type="file"
                        accept="image/*,.ico"
                        onChange={handleFaviconChange}
                        className="hidden"
                      />
                    </label>
                    <div className="mt-1 text-[11px] text-muted-foreground">Recommended: 32x32px .ico or .png</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-border/60 flex justify-end">
              <button
                disabled={saveSettings.isPending}
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-medium text-primary-foreground shadow-gold hover:opacity-95 disabled:opacity-60 cursor-pointer"
              >
                {saveSettings.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Settings
              </button>
            </div>
          </form>
        )}
      </div>
      <style>{`.pi{width:100%;background:var(--input);border:1px solid var(--border);color:var(--foreground);border-radius:.5rem;padding:.6rem .8rem;font-size:.9rem;outline:none}.pi:focus{border-color:var(--gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--gold) 20%,transparent)}`}</style>
    </>
  );
}
