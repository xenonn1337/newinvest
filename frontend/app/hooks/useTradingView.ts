"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    TradingView?: any;
  }
}

/**
 * Load the TradingView widget script once and expose a ready flag.
 */
export function useTradingView(): boolean {
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.TradingView) {
      setReady(true);
      return;
    }

    const scriptId = "tradingview-widget-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    const handleLoad = () => setReady(true);
    const handleError = () => setReady(false);

    if (existing) {
      existing.addEventListener("load", handleLoad);
      existing.addEventListener("error", handleError);
      return () => {
        existing.removeEventListener("load", handleLoad);
        existing.removeEventListener("error", handleError);
      };
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = handleLoad;
    script.onerror = handleError;
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  return ready;
}
