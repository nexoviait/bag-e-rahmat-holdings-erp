import { configureEcho } from "@laravel/echo-react";

/**
 * Wires up the global Echo/Reverb client for real-time chat, presence, and
 * (later) call signaling.
 *
 * This app is pure Sanctum Bearer-token auth (see lib/api.ts's axios
 * interceptor + AuthController) — no cookie session, no CSRF anywhere. Echo's
 * own `bearerToken`/`auth.headers` config options look tailor-made for that,
 * but they're captured ONCE into a plain object at Echo-instance-construction
 * time (see node_modules/laravel-echo/dist/echo.js's `setOptions()`) and
 * never re-read afterwards. Since this SPA logs in/out via client-side React
 * state with no full page reload (app.tsx's MainApp), a token read once at
 * module-load time — before the user has even logged in — would go stale
 * forever the first time someone logs in without refreshing the page.
 *
 * pusher-js's `authorizer` option (still fully supported — just superseded by
 * `channelAuthorization.customHandler` in the newer docs, same mechanism)
 * sidesteps that entirely: the generator below runs once per channel
 * subscription attempt and its returned `authorize()` method fires again on
 * every (re)subscribe, including reconnects and a later login as a different
 * user. Reading `localStorage` INSIDE `authorize()` — not captured in the
 * generator's outer closure — means every private/presence channel
 * subscription always authorizes with whatever token is current *right now*.
 */
export function initEcho() {
  configureEcho({
    broadcaster: "reverb",
    authorizer: (channel: { name: string }) => ({
      authorize(socketId: string, callback: (error: Error | null, data: any) => void) {
        const token = localStorage.getItem("auth_token");

        fetch("/broadcasting/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            socket_id: socketId,
            channel_name: channel.name,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              throw new Error(`Channel authorization failed (${res.status})`);
            }
            return res.json();
          })
          .then((data) => callback(null, data))
          .catch((error) => callback(error, null));
      },
    }),
  });
}
