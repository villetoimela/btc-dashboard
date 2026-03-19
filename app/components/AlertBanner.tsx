"use client";

import { useState, useEffect, useCallback } from "react";

const PERM_KEY = "btc-dash-notif-perm";
const TOAST_DURATION = 5000;

export interface ToastMessage {
  id: string;
  text: string;
  type: "info" | "success" | "warning";
  timestamp: number;
}

interface AlertBannerProps {
  toasts: ToastMessage[];
  onDismissToast: (id: string) => void;
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<"default" | "granted" | "denied">("default");

  useEffect(() => {
    const stored = localStorage.getItem(PERM_KEY);
    if (stored === "granted" || stored === "denied") {
      setPermission(stored);
    } else if (typeof Notification !== "undefined") {
      setPermission(Notification.permission as "default" | "granted" | "denied");
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result as "default" | "granted" | "denied");
      localStorage.setItem(PERM_KEY, result);
    } catch {
      setPermission("denied");
    }
  }, []);

  const sendNotification = useCallback(
    (title: string, body: string) => {
      if (permission !== "granted" || typeof Notification === "undefined") return;
      try {
        new Notification(title, { body, icon: "/favicon.ico" });
      } catch {
        // Silent fail for environments that don't support notifications
      }
    },
    [permission]
  );

  return { permission, requestPermission, sendNotification };
}

export default function AlertBanner({ toasts, onDismissToast }: AlertBannerProps) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => onDismissToast(t.id), TOAST_DURATION)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const bgColor =
          toast.type === "success"
            ? "bg-green-500/20 border-green-500/40"
            : toast.type === "warning"
              ? "bg-red-500/20 border-red-500/40"
              : "bg-blue-500/20 border-blue-500/40";

        return (
          <div
            key={toast.id}
            className={`${bgColor} border rounded-lg px-4 py-3 text-sm text-gray-200 animate-slide-in backdrop-blur-sm`}
          >
            <div className="flex items-start justify-between gap-2">
              <span>{toast.text}</span>
              <button
                onClick={() => onDismissToast(toast.id)}
                className="text-gray-500 hover:text-gray-300 text-lg leading-none"
              >
                x
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
