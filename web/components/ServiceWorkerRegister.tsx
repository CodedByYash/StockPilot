"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // installability just degrades gracefully if this fails — never block the app on it
      });
    }
  }, []);

  return null;
}
