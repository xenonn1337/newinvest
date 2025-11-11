"use client";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Candle = { Date: string; Close: number };

type IndicatorsResp = {
  rsi: number;
  macd: number;
  bb_upper: number;
  bb_lower: number;
};

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

async function getHistory(ticker: string): Promise<Candle[]> {
  const start = new Date(Date.now() - 220 * 86400000)
    .toISOString()
    .slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  const url = `${API}/history?ticker=${encodeURIComponent(
    ticker
  )}&start=${start}&end=${end}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`History error ${res.status}`);
  return res.json();
}

async function getIndicators(ticker: string): Promise<IndicatorsResp> {
  const res = await fetch(`${API}/indicators?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error(`Indicators error ${res.status}`);
  return res.json();
}

/** Compute RSI (14) */
function computeRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi.push(100 - 100 / (1 + (avgLoss === 0 ? Infinity : avgGain / avgLoss)));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = Math.max(0, diff);
    const loss = Math.max(0, -diff);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return Array(Math.max(0, closes.length - rsi.length)).fill(50).concat(rsi);
}

/** Compute MACD (12,26,9) returns MACD line */
function computeMACD(closes: number[], fast = 12, slow = 26, signal = 9): number[] {
  const ema = (period: number) => {
    const k = 2 / (period + 1);
    const arr: number[] = [];
    let prev = closes[0];
    arr.push(prev);
    for (let i = 1; i < closes.length; i++) {
      prev = closes[i] * k + prev * (1 - k);
      arr.push(prev);
    }
    return arr;
  };
  const emaFast = ema(fast);
  const emaSlow = ema(slow);
  const macd = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const k = 2 / (signal + 1);
  const signalLine: number[] = [];
  let prev = macd[0];
  signalLine.push(prev);
  for (let i = 1; i < macd.length; i++) {
    prev = macd[i] * k + prev * (1 - k);
    signalLine.push(prev);
  }
  return macd.map((m, i) => m - signalLine[i]);
}

/** Compute Bollinger Bands (20, 2) return upper and lower arrays */
function computeBB(closes: number[], period = 20, mult = 2): { upper: number[]; lower: number[] } {
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const start = Math.max(0, i - period + 1);
    const slice = closes.slice(start, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance =
      slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      Math.max(1, slice.length - 1);
    const sd = Math.sqrt(variance);
    upper.push(mean + mult * sd);
    lower.push(mean - mult * sd);
  }
  return { upper, lower };
}

function Spark({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / Math.max(1e-9, max - min)) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" className="w-full h-12">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}

export default function IndicatorPanel({ ticker }: { ticker: string }) {
  const [closes, setCloses] = useState<number[]>([]);
  const [latest, setLatest] = useState<IndicatorsResp | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [h, ind] = await Promise.all([getHistory(ticker), getIndicators(ticker)]);
        setCloses(h.map((c) => c.Close));
        setLatest(ind);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load indicators");
      }
    })();
  }, [ticker]);

  const rsi = useMemo(() => (closes.length ? computeRSI(closes) : []), [closes]);
  const macd = useMemo(() => (closes.length ? computeMACD(closes) : []), [closes]);
  const bb = useMemo(() => (closes.length ? computeBB(closes) : { upper: [], lower: [] }), [closes]);

  return (
    <div className="glass rounded-3xl p-4">
      <div className="text-sm text-slate-400 mb-3">Technical Indicators</div>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm">RSI (14)</span>
            <span className="text-sm text-slate-400">
              {latest ? latest.rsi.toFixed(2) : "—"}
            </span>
          </div>
          <Spark data={rsi.slice(-60)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm">MACD (12,26,9)</span>
            <span className="text-sm text-slate-400">
              {latest ? latest.macd.toFixed(4) : "—"}
            </span>
          </div>
          <Spark data={macd.slice(-60)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Bollinger (20,2)</span>
            <span className="text-sm text-slate-400">
              {latest ? `${latest.bb_lower.toFixed(2)} / ${latest.bb_upper.toFixed(2)}` : "—"}
            </span>
          </div>
          <Spark data={bb.upper.slice(-60).map((u, i) => u - (bb.lower[i] ?? u))} />
        </div>
      </div>
    </div>
  );
}
