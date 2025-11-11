// app/layout.tsx
import "./globals.css";
import ClientProvider from "./ClientProvider";
import { Toaster } from "sonner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Stock Forecast Engine",
  description:
    "Next-gen LSTM-driven forecasts with backtests, indicators, and TradingView charts.",
  openGraph: {
    title: "AI Stock Forecast Engine",
    description:
      "Next-gen LSTM-driven forecasts with backtests, indicators, and TradingView charts.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-900 text-slate-100 antialiased">
        <ClientProvider>
          {children}
          <Toaster theme="dark" richColors />
        </ClientProvider>
      </body>
    </html>
  );
}