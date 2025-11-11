"use client";
import React from "react";

export default function Hero({
  onCTAClick,
}: {
  onCTAClick: () => void;
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.15),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(168,85,247,0.12),transparent_40%)] pointer-events-none" />
      <div className="max-w-6xl mx-auto px-6 py-28 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          AI Stock Forecast Engine
        </h1>
        <p className="mt-6 text-lg md:text-xl text-slate-300">
          LSTM-powered predictions, backtesting, and technicals—rendered on a
          fast, beautiful dashboard.
        </p>
        <button
          onClick={onCTAClick}
          className="mt-10 px-6 py-3 rounded-2xl glass hover:bg-white/10 transition"
        >
          Open Dashboard
        </button>
      </div>
    </section>
  );
}
