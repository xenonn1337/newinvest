"use client";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    TradingView: any;
  }
}

type PredictResponse = {
  dates: string[];
  prices: number[];
  rmse: number;
};

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

async function getPrediction(
  ticker: string,
  days: number
): Promise<PredictResponse> {
  const url = `${API}/predict?ticker=${encodeURIComponent(
    ticker
  )}&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Predict error ${res.status}: ${msg}`);
  }
  return res.json();
}

export default function ForecastChart({
  ticker,
  days,
}: {
  ticker: string;
  days: number;
}) {
  const containerId = "tv-chart";
  const [loading, setLoading] = useState(false);
  const widgetRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  // Load TradingView script once
  useEffect(() => {
    if (window.TradingView) return;
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  // Init widget
  useEffect(() => {
    if (!window.TradingView) return;
    if (widgetRef.current) widgetRef.current.remove();
    widgetRef.current = new window.TradingView.widget({
      container_id: containerId,
      symbol: ticker,
      theme: "dark",
      interval: "D",
      hide_top_toolbar: false,
      autosize: true,
      studies: ["RSI@tv-basicstudies"],
      locale: "en",
    });
    widgetRef.current.onChartReady(async () => {
      try {
        setLoading(true);
        const data = await getPrediction(ticker, days);
        // Build forecast series
        const series = widgetRef.current
          .chart()
          .createMultilineSeries({ title: "Forecast" });
        const tvData = data.dates.map((d, i) => ({
          time: Math.floor(new Date(d).getTime() / 1000),
          value: data.prices[i],
        }));
        series.setData(tvData);
        seriesRef.current = series;
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load forecast");
      } finally {
        setLoading(false);
      }
    });
  }, [ticker, days]);

  // Predict button re-fetch
  const handlePredict = async () => {
    try {
      setLoading(true);
      const data = await getPrediction(ticker, days);
      const tvData = data.dates.map((d, i) => ({
        time: Math.floor(new Date(d).getTime() / 1000),
        value: data.prices[i],
      }));
      if (seriesRef.current?.setData) {
        seriesRef.current.setData(tvData);
      } else {
        toast.error("Forecast series not ready");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{ticker} • Advanced Chart</h3>
        <button
          onClick={handlePredict}
          className="px-4 py-2 rounded-xl glass hover:bg-white/10"
        >
          {loading ? "Predicting…" : "Predict"}
        </button>
      </div>
      <div id={containerId} className="w-full h-[520px]" />
    </div>
  );
}
