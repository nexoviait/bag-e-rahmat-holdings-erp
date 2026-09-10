import axios from "axios";
import { echo, echoIsConfigured } from "@laravel/echo-react";

export const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Tags every request with this tab's WebSocket socket id so a chat
  // controller can call ->toOthers() when it broadcasts — the sender's own
  // tab already rendered its message/read-receipt optimistically and would
  // otherwise also receive an echo of its own action over the socket.
  // Silently omitted (not every request needs it, and Echo may not have a
  // live connection yet e.g. before the Reverb socket finishes connecting).
  try {
    if (echoIsConfigured()) {
      const socketId = echo().socketId();
      if (socketId) {
        config.headers["X-Socket-Id"] = socketId;
      }
    }
  } catch {
    // Echo not ready yet — fine, the request just won't be excluded from
    // its own broadcast.
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_session");
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth";
      }
    }
    return Promise.reject(error);
  }
);
