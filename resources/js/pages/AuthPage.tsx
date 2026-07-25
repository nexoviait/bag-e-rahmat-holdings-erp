import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight, Loader2, Lock, Mail, AlertCircle } from "lucide-react";

export function AuthPage() {
  const { user, setUser } = useSession();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = "Email address is required.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setBusy(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("auth_token", res.data.token);
      localStorage.setItem("user_session", JSON.stringify(res.data.user));
      setUser(res.data.user);
      toast.success(`Welcome back to ${appName}.`);
      navigate("/dashboard");
    } catch (err: any) {
      const apiErrors = err.response?.data?.errors;
      const msg = err.response?.data?.message || "Invalid credentials. Please check your email and password.";
      if (apiErrors) {
        setErrors({
          email: apiErrors.email?.[0],
          password: apiErrors.password?.[0],
        });
      } else {
        setErrors({ email: msg });
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="absolute inset-0 hairline-grid opacity-30" />
      <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative w-full max-w-lg">
        {/* Brand Header */}
        <div className="mb-8 flex items-center justify-center">
          {appLogo ? (
            <img src={appLogo} alt={appName} className="h-14 max-w-[280px] object-contain" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold to-gold-soft text-primary-foreground shadow-gold">
                <span className="font-display text-base font-bold">{appName.slice(0, 1).toUpperCase()}</span>
              </div>
              <div className="leading-tight">
                <span className="font-display text-xl font-bold tracking-tight">
                  {appName}
                </span>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {appSubtitle}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="noir-panel p-8 shadow-2xl">
          <div className="text-center sm:text-left">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your workspace credentials to access your account.
            </p>
          </div>

          <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Email Address" icon={Mail} error={errors.email}>
              <input
                type="text"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className={`w-full rounded-lg border bg-input px-3.5 py-2.5 text-sm text-foreground outline-none transition ${
                  errors.email
                    ? "border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive"
                    : "border-border focus:border-gold focus:ring-1 focus:ring-gold"
                }`}
                placeholder="you@bage-rahmat.com"
              />
            </Field>

            <Field label="Password" icon={Lock} error={errors.password}>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                className={`w-full rounded-lg border bg-input px-3.5 py-2.5 text-sm text-foreground outline-none transition ${
                  errors.password
                    ? "border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive"
                    : "border-border focus:border-gold focus:ring-1 focus:ring-gold"
                }`}
                placeholder="••••••••"
              />
            </Field>

            <button
              disabled={busy}
              type="submit"
              className="group relative flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold to-gold-soft py-3 font-medium text-primary-foreground shadow-gold transition hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Sign in to ERP</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  error,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-gold" />}
        {label}
      </span>
      {children}
      {error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in duration-200">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
