"use client";
import React, { useRef } from "react";
import Hero from "./components/Hero";
import Dashboard from "./components/Dashboard";

export default function Page() {
  const dashRef = useRef<HTMLDivElement>(null);

  return (
    <main>
      <Hero
        onCTAClick={() => {
          dashRef.current?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      <div ref={dashRef}>
        <Dashboard />
      </div>
    </main>
  );
}
