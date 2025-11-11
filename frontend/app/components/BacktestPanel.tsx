"use client";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    TradingView: any;
  }
}

type Candle = {
  Date: string;
  Close: number;
};

type PredictResponse = {
  dates: string[];
  prices: number[];
  rmse: number;
};

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

async function getHistoryRange(
  ticker: string,
  start: string,
  end: string
): Promise<Candle[]> {
  const url = `${API}/history?ticker=${encodeURIComponent(
    ticker
  )}&start=${start}&end=${end}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`History error ${res.status}`);
  return res.json();
}

async function getPredictionAsOf(
  ticker: string,
  days: number,
  asof: string
): Promise<PredictResponse> {
  const url = `${API}/predict?ticker=${encodeURIComponent(
    ticker
  )}&days=${days}&asof=${asof}`;
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
      locale: "en",
    });
    widgetRef.current.onChartReady(() => {
      predSeriesRef.current = widgetRef.current
        .chart()
        .createMultilineSeries({ title: "Predicted (as-of)" });
      realSeriesRef.current = widgetRef.current
        .chart()
        .createMultilineSeries({ title: "Actual" });
    });
  }, [ticker]);

  const runBacktest = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [hist, pred] = await Promise.all([
        getHistoryRange(ticker, date, today),
        getPredictionAsOf(ticker, days, date),
      ]);
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
        if (i < predCloses.length) {
          retPred.push(
            (predCloses[i] - predCloses[i - 1]) / predCloses[i - 1]
          );
        }
      }
      setStats({ sharpePred: sharpe(retPred), sharpeBH: sharpe(retBH) });
    } catch (e: any) {
      toast.error(e?.message ?? "Backtest failed");
    }
  };

  useEffect(() => {
    if (widgetRef.current) runBacktest();
  }, [ticker]);

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
            className="px-3 py-2 rounded-xl glass hover:bg-white/10"
          >
            Run
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
