"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker. Kept deliberately small: the worker only
 * caches the static shell so the parent app opens instantly and shows a useful
 * screen with no signal. Live data always goes to the network.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // A failed registration must never break the app.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
