import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";

import { api } from "@/lib/api";
import { AuthContext, UserSession } from "@/lib/session";
import { AppShell } from "@/components/AppShell";

import { AuthPage } from "@/pages/AuthPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { AssignmentsPage } from "@/pages/admin/AssignmentsPage";
import { RolesPage } from "@/pages/admin/RolesPage";
import { SettingsPage } from "@/pages/admin/SettingsPage";
import { ActivityLogsPage } from "@/pages/admin/ActivityLogsPage";
import { MonitoringPage } from "@/pages/MonitoringPage";

const queryClient = new QueryClient({
  // Without this, a failed useQuery (network down, 500, etc.) just leaves
  // `data` undefined once loading settles — pages that only branch on
  // `isLoading` (most of them) then render their normal "nothing here yet"
  // empty state, which is actively misleading: it looks like "you have no
  // projects" when the real story is "the request failed." A global handler
  // here covers every query in the app without needing every page updated
  // individually.
  queryCache: new QueryCache({
    onError: (error: any, query) => {
      // Session expiry is already handled by the axios interceptor in
      // lib/api.ts (redirects to /auth) — don't also toast it here.
      if (error?.response?.status === 401) return;

      // Only toast a query's FIRST failure (no data ever successfully
      // loaded). A background refetch failing while good data is still on
      // screen — e.g. one of the 30-60s CCTV status polls — would otherwise
      // toast repeatedly and become noise instead of a signal.
      if (query.state.data !== undefined) return;

      const message = error?.response?.data?.message || error?.message || "Failed to load data. Please try again.";
      toast.error(message);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedLayout() {
  const { user, loading } = React.useContext(AuthContext);

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-gold">
        <div className="font-display text-lg font-semibold animate-pulse">
          Loading ERP System...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function MainApp() {
  const [user, setUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem("user_session");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const token = localStorage.getItem("auth_token");
    return !token ? false : true;
  });

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_session");
      setUser(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem("user_session", JSON.stringify(res.data.user));
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user_session");
          setUser(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />

            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:projectId/*" element={<ProjectDetailPage />} />
              <Route path="/monitoring" element={<MonitoringPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/assignments" element={<AssignmentsPage />} />
              <Route path="/admin/roles" element={<RolesPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
              <Route path="/admin/logs" element={<ActivityLogsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="top-right"
          theme="dark"
          richColors
          mobileOffset={{ top: "72px", right: "16px", left: "16px" }}
        />
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <MainApp />
    </React.StrictMode>
  );
}
