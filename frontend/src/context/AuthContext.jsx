import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore, formatApiErrorDetail } from "../lib/api";

const AuthContext = createContext(null);
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  // user states: undefined = checking, null = unauthenticated, object = authenticated
  const [user, setUser] = useState(undefined);

  const fetchMe = useCallback(async () => {
    const token = tokenStore.get();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    let timeoutId;
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        logout();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [user, logout]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.requires_2fa) {
        return { ok: true, requires_2fa: true, temp_token: data.temp_token };
      }
      tokenStore.set(data.access_token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 403 && detail === "membership_inactive") {
        return { ok: false, error: "membership_inactive", access_denied: true };
      }
      return { ok: false, error: formatApiErrorDetail(detail) || e.message };
    }
  };

  const verify2fa = async (tempToken, code) => {
    try {
      const { data } = await api.post("/auth/2fa/verify", { temp_token: tempToken, code });
      tokenStore.set(data.access_token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 403 && detail === "membership_inactive") {
        return { ok: false, error: "membership_inactive", access_denied: true };
      }
      return { ok: false, error: formatApiErrorDetail(detail) || e.message };
    }
  };

  const register = async (name, email, password) => {
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      tokenStore.set(data.access_token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, verify2fa, refresh: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
