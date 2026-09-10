import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  LinkIcon,
  Shield,
  Settings,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  User as UserIcon,
  Lock,
  Mail,
  Phone,
  Save,
  Loader2,
  Video,
} from "lucide-react";
import { useSession, useIsAdmin, useHasPermission, getUserRoles } from "@/lib/session";
import { roleLabels } from "@/lib/format";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AlertsBell } from "@/components/cctv/AlertsBell";
import { ChatIncomingListener } from "@/components/chat/ChatIncomingListener";
import { CallManager } from "@/components/chat/CallManager";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSession();
  const isAdmin = useIsAdmin();
  const canViewCctv = useHasPermission("cctv.view");
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const res = await api.get("/settings");
      return res.data;
    },
  });

  const appName = settings?.app_name ?? "Bag E Rahmat";
  const appSubtitle = settings?.app_subtitle ?? "Holdings ERP";
  const appLogo = settings?.app_logo ?? null;
  const appFavicon = settings?.app_favicon ?? null;

  useEffect(() => {
    if (appFavicon) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "shortcut icon";
        document.head.appendChild(link);
      }
      link.href = appFavicon;
    }
    document.title = `${appName} - ${appSubtitle}`;
  }, [appName, appSubtitle, appFavicon]);

  const roles = getUserRoles(user);
  const highestRole = roles[0] ?? "";

  async function handleSignOut() {
    try {
      await logout();
      toast.success("Signed out");
      navigate("/auth");
    } catch {
      localStorage.clear();
      window.location.href = "/auth";
    }
  }

  const nav = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/projects", label: "Projects", icon: FolderKanban },
    ...(canViewCctv ? [{ to: "/monitoring", label: "Live Monitoring", icon: Video }] : []),
  ];

  return (
    <CallManager>
    <div className="flex min-h-screen bg-background text-foreground">
      <ChatIncomingListener />

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex print:hidden">
        <Link to="/dashboard" className="flex items-center px-6 py-6 min-h-[72px]">
          {appLogo ? (
            <img src={appLogo} alt={appName} className="h-10 max-w-full object-contain" />
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-gold to-gold-soft text-primary-foreground">
                <span className="font-display text-sm font-bold">{appName.slice(0, 1).toUpperCase()}</span>
              </div>
              <div className="leading-tight min-w-0 flex-1">
                <div className="font-display text-sm font-semibold truncate">{appName}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                  {appSubtitle}
                </div>
              </div>
            </div>
          )}
        </Link>

        <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
          <SectionLabel>Workspace</SectionLabel>
          {nav.map((n) => (
            <NavItem
              key={n.to}
              to={n.to}
              active={location.pathname.startsWith(n.to)}
              icon={n.icon}
            >
              {n.label}
            </NavItem>
          ))}
          {isAdmin && (
            <>
              <SectionLabel className="mt-6">Administration</SectionLabel>
              <NavItem
                to="/admin/users"
                active={location.pathname === "/admin/users"}
                icon={Users}
              >
                Users
              </NavItem>
              <NavItem
                to="/admin/assignments"
                active={location.pathname === "/admin/assignments"}
                icon={LinkIcon}
              >
                Assignments
              </NavItem>
              <NavItem
                to="/admin/roles"
                active={location.pathname === "/admin/roles"}
                icon={Shield}
              >
                Roles & Permissions
              </NavItem>

              {/* Settings Parent & Submenu */}
              <div className="mt-2 pt-2 border-t border-border/40">
                <NavItem
                  to="/admin/settings"
                  active={location.pathname.startsWith("/admin/settings") || location.pathname === "/admin/logs"}
                  icon={Settings}
                >
                  Settings
                </NavItem>
                <div className="ml-4 mt-1 pl-3 border-l border-border/60 space-y-1">
                  <Link
                    to="/admin/settings"
                    className={`block py-1 px-2 text-xs rounded-md transition ${
                      location.pathname === "/admin/settings"
                        ? "text-gold font-semibold bg-gold/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    • General Branding
                  </Link>
                  <Link
                    to="/admin/logs"
                    className={`block py-1 px-2 text-xs rounded-md transition ${
                      location.pathname === "/admin/logs"
                        ? "text-gold font-semibold bg-gold/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    • Activity Log
                  </Link>
                </div>
              </div>
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div
              onClick={() => setOpenProfile(true)}
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer p-1.5 -m-1.5 rounded-lg hover:bg-sidebar-accent/60 transition group"
              title="Edit Profile Settings"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/20 font-display text-sm text-gold font-bold group-hover:bg-gold group-hover:text-slate-950 transition">
                {(user?.name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium group-hover:text-gold transition">{user?.name}</div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-gold" />
                  {roleLabels[highestRole] ?? highestRole}
                </div>
              </div>
            </div>
            <AlertsBell />
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="rounded-md p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header Bar */}
      <div className="fixed top-0 inset-x-0 z-40 flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 lg:hidden print:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          {appLogo ? (
            <img src={appLogo} alt={appName} className="h-8 max-w-[160px] object-contain" />
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br from-gold to-gold-soft text-primary-foreground">
                <span className="font-display text-xs font-bold">{appName.slice(0, 1).toUpperCase()}</span>
              </div>
              <div className="font-display text-sm font-semibold truncate">{appName}</div>
            </div>
          )}
        </Link>
        <div className="flex items-center gap-1">
          <AlertsBell />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground cursor-pointer"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 flex lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-40 mt-14 flex w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 shadow-2xl">
            <nav className="flex-1 space-y-1">
              <SectionLabel>Workspace</SectionLabel>
              {nav.map((n) => (
                <NavItem
                  key={n.to}
                  to={n.to}
                  active={location.pathname.startsWith(n.to)}
                  icon={n.icon}
                  onClick={() => setMobileOpen(false)}
                >
                  {n.label}
                </NavItem>
              ))}
              {isAdmin && (
                <>
                  <SectionLabel className="mt-6">Administration</SectionLabel>
                  <NavItem
                    to="/admin/users"
                    active={location.pathname === "/admin/users"}
                    icon={Users}
                    onClick={() => setMobileOpen(false)}
                  >
                    Users
                  </NavItem>
                  <NavItem
                    to="/admin/assignments"
                    active={location.pathname === "/admin/assignments"}
                    icon={LinkIcon}
                    onClick={() => setMobileOpen(false)}
                  >
                    Assignments
                  </NavItem>
                  <NavItem
                    to="/admin/roles"
                    active={location.pathname === "/admin/roles"}
                    icon={Shield}
                    onClick={() => setMobileOpen(false)}
                  >
                    Roles & Permissions
                  </NavItem>

                  <div className="mt-2 pt-2 border-t border-border/40">
                    <NavItem
                      to="/admin/settings"
                      active={location.pathname.startsWith("/admin/settings") || location.pathname === "/admin/logs"}
                      icon={Settings}
                      onClick={() => setMobileOpen(false)}
                    >
                      Settings
                    </NavItem>
                    <div className="ml-4 mt-1 pl-3 border-l border-border/60 space-y-1">
                      <Link
                        to="/admin/settings"
                        onClick={() => setMobileOpen(false)}
                        className={`block py-1 px-2 text-xs rounded-md transition ${
                          location.pathname === "/admin/settings"
                            ? "text-gold font-semibold bg-gold/10"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        • General Branding
                      </Link>
                      <Link
                        to="/admin/logs"
                        onClick={() => setMobileOpen(false)}
                        className={`block py-1 px-2 text-xs rounded-md transition ${
                          location.pathname === "/admin/logs"
                            ? "text-gold font-semibold bg-gold/10"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        • Activity Log
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </nav>
            <div className="border-t border-sidebar-border pt-4">
              <div className="flex items-center justify-between">
                <div
                  onClick={() => {
                    setMobileOpen(false);
                    setOpenProfile(true);
                  }}
                  className="cursor-pointer"
                >
                  <div className="text-sm font-medium hover:text-gold transition">{user?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {roleLabels[highestRole] ?? highestRole}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="min-w-0 flex-1 lg:pl-64 print:pl-0">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 mt-14 lg:mt-0 print:m-0 print:p-0 print:max-w-none">
          {children}
        </div>
      </main>

      {openProfile && (
        <ProfileDialog user={user} onClose={() => setOpenProfile(false)} />
      )}
    </div>
    </CallManager>
  );
}

function ProfileDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");

  const updateProfile = useMutation({
    mutationFn: async () => {
      const res = await api.put("/auth/profile", {
        name,
        email,
        phone,
        password: password || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }
      qc.invalidateQueries({ queryKey: ["auth-me"] });
      qc.invalidateQueries({ queryKey: ["shareholders"] });
      qc.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("Profile updated successfully");
      onClose();
      window.location.reload();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4">
      <div className="noir-panel w-full max-w-md p-6 max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <h3 className="font-display text-xl font-semibold flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-gold" />
              My Profile & Account
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Update your account details, email, and password.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateProfile.mutate();
          }}
          className="mt-5 space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                required
                className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                required
                type="email"
                className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Contact Phone (Optional)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1700-000000"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              New Password (Optional)
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                className="w-full rounded-md border border-border bg-input pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-gold"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-border/60 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border bg-surface-2 px-4 py-2 text-xs font-medium text-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={updateProfile.isPending}
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-medium text-primary-foreground shadow-gold hover:opacity-95 disabled:opacity-60 cursor-pointer"
            >
              {updateProfile.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-gold">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ${className}`}>
      {children}
    </div>
  );
}

function NavItem({
  to,
  active,
  icon: Icon,
  children,
  onClick,
}: {
  to: string;
  active: boolean;
  icon: React.ElementType;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-l-2 border-gold pl-2.5"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-gold" : "text-muted-foreground"}`} />
      <span>{children}</span>
    </Link>
  );
}

export function AdminNavTabs() {
  const location = useLocation();
  const tabs = [
    { to: "/admin/settings", label: "General Branding" },
    { to: "/admin/logs", label: "Activity Log" },
    { to: "/admin/users", label: "User Accounts" },
    { to: "/admin/assignments", label: "Project Access" },
    { to: "/admin/roles", label: "Roles & Permissions" },
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-border/60">
      {tabs.map((t) => {
        const active = location.pathname === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`relative px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition cursor-pointer ${
              active ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
