"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { apiUrl } from "../lib/api";
import { useTradingView } from "../hooks/useTradingView";

type PredictResponse = {
  dates: string[];
  prices: number[];
  rmse: number;
};

async function getPrediction(
  ticker: string,
  days: number
): Promise<PredictResponse> {
  const params = new URLSearchParams({ ticker, days: String(days) });
  const url = `${apiUrl("/predict")}?${params.toString()}`;
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
  const tvReady = useTradingView();
  const tickerRef = useRef(ticker);
  const daysRef = useRef(days);
  const pendingRef = useRef(0);

  useEffect(() => {
    tickerRef.current = ticker;
  }, [ticker]);

  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  const fetchPrediction = useCallback(
    async (targetTicker: string, horizon: number) => {
      pendingRef.current += 1;
      setLoading(true);
      try {
        const data = await getPrediction(targetTicker, horizon);
        const tvData = data.dates.map((d, i) => ({
          time: Math.floor(new Date(d).getTime() / 1000),
          value: data.prices[i],
        }));
        if (
          seriesRef.current &&
          tickerRef.current === targetTicker &&
          daysRef.current === horizon
        ) {
          seriesRef.current.setData(tvData);
        }
        return data;
      } catch (e: any) {
        if (tickerRef.current === targetTicker && daysRef.current === horizon) {
          toast.error(e?.message ?? "Prediction failed");
        }
        throw e;
      } finally {
        pendingRef.current = Math.max(0, pendingRef.current - 1);
        if (pendingRef.current === 0) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Init widget when TradingView is ready or ticker changes
  useEffect(() => {
    if (!tvReady || typeof window === "undefined") return;

    const widget = new window.TradingView.widget({
      container_id: containerId,
      symbol: ticker,
      theme: "dark",
      interval: "D",
      hide_top_toolbar: false,
      autosize: true,
      studies: ["RSI@tv-basicstudies"],
      locale: "en",
    });

    widgetRef.current = widget;
    seriesRef.current = null;

    widget.onChartReady(() => {
      const series = widget.chart().createMultilineSeries({ title: "Forecast" });
      seriesRef.current = series;
      fetchPrediction(tickerRef.current, daysRef.current);
    });

    return () => {
      seriesRef.current = null;
      widgetRef.current = null;
      if (widget.remove) {
        widget.remove();
      }
    };
  }, [tvReady, ticker, fetchPrediction]);

  // Re-fetch predictions when horizon or ticker changes and chart is ready
  useEffect(() => {
    if (!seriesRef.current) return;
    fetchPrediction(ticker, days);
  }, [ticker, days, fetchPrediction]);

  // Predict button re-fetch
  const handlePredict = async () => {
    if (!seriesRef.current) {
      toast.error("Chart not ready yet");
      return;
    }
    try {
      await fetchPrediction(ticker, days);
    } catch {
      // error already surfaced in fetchPrediction
    }
  };

  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{ticker} • Advanced Chart</h3>
        <button
          onClick={handlePredict}
          className="px-4 py-2 rounded-xl glass hover:bg-white/10 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Predicting…" : "Predict"}
        </button>
      </div>
      <div id={containerId} className="w-full h-[520px]" />
    </div>
  );
}
