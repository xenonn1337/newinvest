"use client";
import React, { useMemo, useState } from "react";
import TickerSearch from "./TickerSearch";
import ForecastChart from "./ForecastChart";
import KPICards from "./KPICards";
import IndicatorPanel from "./IndicatorPanel";
import BacktestPanel from "./BacktestPanel";

export default function Dashboard() {
  const [ticker, setTicker] = useState<string>("AAPL");
  const [days, setDays] = useState<number>(90);

  const horizon = useMemo(() => days, [days]);

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6 py-12 grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <div className="glass rounded-3xl p-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <TickerSearch value={ticker} onChange={setTicker} />
            <div className="flex-1">
              <label className="block text-sm text-slate-300">
                Prediction Horizon: {horizon} days
              </label>
              <input
                type="range"
                min={15}
                max={365}
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <ForecastChart ticker={ticker} days={horizon} />

        <KPICards ticker={ticker} days={horizon} />
      </div>

      <div className="lg:col-span-1 space-y-6">
        <IndicatorPanel ticker={ticker} />
        <BacktestPanel ticker={ticker} defaultDays={horizon} />
      </div>
    </section>
  );
}
