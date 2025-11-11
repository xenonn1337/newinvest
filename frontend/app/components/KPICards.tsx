"use client";

import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiUrl } from "../lib/api";

interface PredictResponse {
  dates: string[];
  prices: number[];
  rmse: number;
}

interface KPICardsProps {
  ticker: string;
  days: number;
}

async function getPrediction(ticker: string, days: number): Promise<PredictResponse> {
  const params = new URLSearchParams({ ticker, days: String(days) });
  const res = await fetch(`${apiUrl("/predict")}?${params.toString()}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }

  return res.json();
}

export default function KPICards({ ticker, days }: KPICardsProps) {
  const { data, error, isLoading } = useQuery<PredictResponse>({
    queryKey: ["prediction", ticker, days],
    queryFn: () => getPrediction(ticker, days),
    enabled: !!ticker && !!days,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load prediction");
    }
  }, [error]);

  if (isLoading)
    return <div className="text-center py-8 text-sm text-slate-300">Loading prediction…</div>;
  if (!data?.prices?.length)
    return <div className="text-center py-8 text-sm text-slate-300">No forecast available</div>;

  const startPrice = data.prices[0];
  const finalPrice = data.prices[data.prices.length - 1];
  const change = startPrice ? ((finalPrice - startPrice) / startPrice) * 100 : 0;
  const rmseValue = Number.isFinite(data.rmse) ? data.rmse : null;
  const confidence =
    rmseValue && startPrice
      ? Math.max(0, Math.min(100, 100 - (rmseValue / startPrice) * 100))
      : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
      <div className="glass border border-slate-700/60 p-6 rounded-xl">
        <h3 className="text-sm font-medium text-slate-400">Projected Price</h3>
        <p className="text-3xl font-bold text-white mt-2">
          ${finalPrice.toFixed(2)}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {data.dates[data.dates.length - 1]}
        </p>
      </div>
      <div className="glass border border-slate-700/60 p-6 rounded-xl">
        <h3 className="text-sm font-medium text-slate-400">Projected Change</h3>
        <p
          className={`text-3xl font-bold mt-2 ${
            change > 0 ? "text-green-400" : change < 0 ? "text-red-400" : "text-slate-200"
          }`}
        >
          {change > 0 ? "+" : ""}
          {change.toFixed(1)}%
        </p>
        <p className="text-xs text-slate-400 mt-1">vs. first forecasted close</p>
      </div>
      <div className="glass border border-slate-700/60 p-6 rounded-xl">
        <h3 className="text-sm font-medium text-slate-400">Model Confidence</h3>
        <p className="text-3xl font-bold text-white mt-2">
          {confidence !== null ? `${confidence.toFixed(0)}%` : "—"}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          RMSE (90d): {rmseValue !== null ? rmseValue.toFixed(2) : "n/a"}
        </p>
      </div>
    </div>
  );
}
