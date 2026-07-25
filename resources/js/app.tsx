import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

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

const queryClient = new QueryClient({
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
