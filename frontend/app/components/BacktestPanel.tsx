"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { apiUrl } from "../lib/api";
import { useTradingView } from "../hooks/useTradingView";

type Candle = {
  Date: string;
  Close: number;
};

type PredictResponse = {
  dates: string[];
  prices: number[];
  rmse: number;
};

async function getHistoryRange(
  ticker: string,
  start: string,
  end: string
): Promise<Candle[]> {
  const params = new URLSearchParams({ ticker, start, end });
  const url = `${apiUrl("/history")}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`History error ${res.status}`);
  return res.json();
}

async function getPredictionAsOf(
  ticker: string,
  days: number,
  asof: string
): Promise<PredictResponse> {
  const params = new URLSearchParams({ ticker, days: String(days), asof });
  const url = `${apiUrl("/predict")}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Predict error ${res.status}`);
  return res.json();
}

function sharpe(returns: number[], rf = 0): number {
  const mean =
    returns.reduce((a, b) => a + b, 0) / Math.max(1, returns.length);
  const variance =
    returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
    Math.max(1, returns.length - 1);
  const sd = Math.sqrt(variance);
  return sd === 0 ? 0 : ((mean - rf) / sd) * Math.sqrt(252);
}

export default function BacktestPanel({
  ticker,
  defaultDays,
}: {
  ticker: string;
  defaultDays: number;
}) {
  const [date, setDate] = useState<string>(() => {
    const d = new Date(Date.now() - 180 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [days, setDays] = useState<number>(defaultDays);
  const containerId = "tv-backtest";
  const widgetRef = useRef<any>(null);
  const predSeriesRef = useRef<any>(null);
  const realSeriesRef = useRef<any>(null);
  const [stats, setStats] = useState<{ sharpePred: number; sharpeBH: number }>();
  const [loading, setLoading] = useState(false);
  const tvReady = useTradingView();

  const runBacktest = useCallback(async () => {
    if (!predSeriesRef.current || !realSeriesRef.current) return;
    const request = { ticker, asof: date, horizon: days };
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [hist, pred] = await Promise.all([
        getHistoryRange(request.ticker, request.asof, today),
        getPredictionAsOf(request.ticker, request.horizon, request.asof),
      ]);

      if (
        request.ticker !== ticker ||
        request.asof !== date ||
        request.horizon !== days
      ) {
        return;
      }

      const actual = hist.map((c) => ({
        time: Math.floor(new Date(c.Date).getTime() / 1000),
        value: c.Close,
      }));
      const predicted = pred.dates.map((d, i) => ({
        time: Math.floor(new Date(d).getTime() / 1000),
        value: pred.prices[i],
      }));

      realSeriesRef.current?.setData(actual);
      predSeriesRef.current?.setData(predicted);

      const actualCloses = hist.map((h) => h.Close);
      const predCloses = pred.prices.slice(0, actualCloses.length);

      const retBH: number[] = [];
      const retPred: number[] = [];
      for (let i = 1; i < actualCloses.length; i++) {
        retBH.push((actualCloses[i] - actualCloses[i - 1]) / actualCloses[i - 1]);
        if (i < predCloses.length && predCloses[i - 1] !== 0) {
          retPred.push(
            (predCloses[i] - predCloses[i - 1]) / predCloses[i - 1]
          );
        }
      }
      setStats({ sharpePred: sharpe(retPred), sharpeBH: sharpe(retBH) });
    } catch (e: any) {
      toast.error(e?.message ?? "Backtest failed");
    } finally {
      setLoading(false);
    }
  }, [ticker, date, days]);

  useEffect(() => {
    if (!tvReady || typeof window === "undefined") return;

    const widget = new window.TradingView.widget({
      container_id: containerId,
      symbol: ticker,
      theme: "dark",
      interval: "D",
      hide_top_toolbar: false,
      autosize: true,
      locale: "en",
    });

    widgetRef.current = widget;
    predSeriesRef.current = null;
    realSeriesRef.current = null;

    widget.onChartReady(() => {
      predSeriesRef.current = widget
        .chart()
        .createMultilineSeries({ title: "Predicted (as-of)" });
      realSeriesRef.current = widget
        .chart()
        .createMultilineSeries({ title: "Actual" });
      runBacktest();
    });

    return () => {
      predSeriesRef.current = null;
      realSeriesRef.current = null;
      widgetRef.current = null;
      if (widget.remove) {
        widget.remove();
      }
    };
  }, [tvReady, ticker, runBacktest]);

  useEffect(() => {
    if (!predSeriesRef.current || !realSeriesRef.current) return;
    runBacktest();
  }, [runBacktest]);

  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-sm text-slate-400">Back-test</div>
          <div className="text-xs text-slate-500">
            Compare predicted (as-of date) vs actual
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-xl glass"
          />
          <div className="hidden md:block">
            <label className="block text-xs text-slate-400">
              Horizon: {days}d
            </label>
            <input
              type="range"
              min={15}
              max={365}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
            />
          </div>
          <button
            onClick={runBacktest}
            className="px-3 py-2 rounded-xl glass hover:bg-white/10 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Running…" : "Run"}
          </button>
        </div>
      </div>
      <div id={containerId} className="w-full h-[360px]" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-3">
          <div className="text-xs text-slate-400">Sharpe (Predicted)</div>
          <div className="text-xl font-semibold">
            {stats ? stats.sharpePred.toFixed(2) : "—"}
          </div>
        </div>
        <div className="glass rounded-2xl p-3">
          <div className="text-xs text-slate-400">Sharpe (Buy & Hold)</div>
          <div className="text-xl font-semibold">
            {stats ? stats.sharpeBH.toFixed(2) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
