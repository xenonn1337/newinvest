"use client";

import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface PredictResponse {
  dates: string[];
  predictions: number[];
}

interface KPICardsProps {
  ticker: string;
  days: number;
}

async function getPrediction(ticker: string, days: number): Promise<PredictResponse> {
  const url = `http://localhost:8000/predict?ticker=${ticker}&days=${days}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }

  return res.json();
}

export default function KPICards({ ticker, days }: KPICardsProps) {
  const { data, error, isLoading } = useQuery({
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

  if (isLoading) return <div className="text-center py-8">Loading prediction...</div>;
  if (!data?.predictions?.length) return <div className="text-center py-8">No data available</div>;

  const finalPrice = data.predictions[data.predictions.length - 1];
  const change = ((finalPrice - 150) / 150) * 100; // mock current price

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400">Final Prediction</h3>
        <p className="text-3xl font-bold text-white mt-2">
          ${finalPrice.toFixed(2)}
        </p>
      </div>
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400">Change</h3>
        <p className={`text-3xl font-bold mt-2 ${change > 0 ? "text-green-400" : "text-red-400"}`}>
          {change > 0 ? "+" : ""}{change.toFixed(1)}%
        </p>
      </div>
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400">Confidence</h3>
        <p className="text-3xl font-bold text-white mt-2">87%</p>
      </div>
    </div>
  );
}
