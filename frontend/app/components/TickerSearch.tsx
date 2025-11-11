"use client";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Quote = { symbol: string; shortname?: string; exchDisp?: string };

async function fetchYahooSuggestions(q: string): Promise<Quote[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    q
  )}&quotesCount=8&newsCount=0&listsCount=0`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Yahoo search failed (${res.status})`);
  }
  const data = await res.json();
  return (data?.quotes ?? [])
    .filter((x: any) => x.symbol && /^[A-Z.\-]+$/.test(x.symbol))
    .slice(0, 8)
    .map((x: any) => ({
      symbol: x.symbol,
      shortname: x.shortname,
      exchDisp: x.exchDisp,
    }));
}

export default function TickerSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [input, setInput] = useState<string>(value);
  const [options, setOptions] = useState<Quote[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => setInput(value), [value]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!input || input.length < 1) return setOptions([]);
      setLoading(true);
      try {
        const opts = await fetchYahooSuggestions(input);
        setOptions(opts);
      } catch (e: any) {
        toast.error(e?.message ?? "Autocomplete failed");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [input]);

  const list = useMemo(
    () =>
      options.map((o) => (
        <button
          key={o.symbol}
          onClick={() => {
            onChange(o.symbol);
            setOptions([]);
          }}
          className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-lg"
        >
          <div className="font-medium">{o.symbol}</div>
          <div className="text-xs text-slate-400">
            {o.shortname ?? "—"} • {o.exchDisp ?? ""}
          </div>
        </button>
      )),
    [options, onChange]
  );

  return (
    <div className="relative w-full md:w-96">
      <label className="block text-sm text-slate-300">Ticker</label>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        placeholder="e.g. AAPL, MSFT, TSLA..."
        className="mt-1 w-full px-3 py-2 rounded-2xl glass outline-none"
      />
      {loading && <div className="absolute right-3 top-9 text-sm">…</div>}
      {options.length > 0 && (
        <div className="absolute z-20 mt-2 w-full glass rounded-2xl p-2">
          {list}
        </div>
      )}
    </div>
  );
}
