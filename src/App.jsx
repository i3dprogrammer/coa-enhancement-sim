import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Info, Moon, Sun } from "lucide-react";

// ------------------------------------------------------------
// Universal Enhancement Simulator — Single‑File React App (Dark Mode)
// ------------------------------------------------------------
// Supports ANY single‑step upgrade +L → +(L+1) with configurable stars.
// Now includes a built‑in light/dark theme toggle (persists to localStorage)
// and adjusts cards, inputs, tables, and charts for readability.
// ------------------------------------------------------------

// Default suggested star rule (edit as needed):
//  - L ≤ 15 → 3 stars (e.g., 15→16)
//  - L ≥ 20 → 5 stars (e.g., 20→21)
//  - otherwise → 4 stars (e.g., 18→19)
function suggestedStarsForLevel(L) {
  if (L <= 15) return 3;
  if (L >= 20) return 5;
  return 4;
}

// Seeded RNG (LCG)
function createLCG(seed) {
  let state = seed >>> 0 || 1;
  return function rand() {
    state = (1664525 * state + 1013904223) >>> 0; // Numerical Recipes
    return state / 0xffffffff;
  };
}

// Percentile helper
function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const pos = (sortedArr.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] !== undefined) {
    return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  }
  return sortedArr[base];
}

function formatNumber(n) {
  if (!isFinite(n)) return "∞";
  return Number(n).toLocaleString();
}

function formatGold(n) {
  if (!isFinite(n)) return "∞";
  return `${formatNumber(Math.round(n))} gold`;
}

// ------------------------------------------------------------
// Core Simulators (generalized to N stars)
// ------------------------------------------------------------
function simulateFullRun(params, rand) {
  const {
    goldPerAttempt,
    starProbs, // length = numStars
    finalProb,
    starPityThreshold,
    finalPityThreshold,
    starPityResetsOnAnyFail,
    numStars,
  } = params;

  let attempts = 0;
  let gold = 0;

  let starPityFails = Array(numStars).fill(0);
  let finalPityFails = 0; // persists until success
  let starAttempts = Array(numStars).fill(0);

  const handleFailReset = () => {
    if (starPityResetsOnAnyFail) {
      starPityFails = Array(numStars).fill(0);
    }
  };

  for (;;) {
    // Build all stars
    let currentStars = 0;
    for (let i = 0; i < numStars; i++) {
      attempts += 1;
      gold += goldPerAttempt;
      starAttempts[i] += 1; // count this star attempt
      const guaranteed = starPityFails[i] >= starPityThreshold;
      const success = guaranteed || rand() < starProbs[i];
      if (success) {
        currentStars += 1;
        starPityFails[i] = 0; // reset pity for this star
      } else {
        starPityFails[i] += 1;
        handleFailReset();
        currentStars = 0;
        i = -1; // restart from star 1
      }
    }

    // Attempt final upgrade
    attempts += 1;
    gold += goldPerAttempt;
    const finalGuaranteed = finalPityFails >= finalPityThreshold;
    const finalSuccess = finalGuaranteed || rand() < finalProb;
    if (finalSuccess) {
      return { attempts, gold, starAttempts };
    }
    // final failed
    finalPityFails += 1; // persists
    handleFailReset(); // stars drop to 0 (and possibly reset pity if configured)
  }
}

function simulateStarsOnly(params, rand) {
  const { goldPerAttempt, starProbs, starPityThreshold, starPityResetsOnAnyFail, numStars } = params;
  let attempts = 0;
  let gold = 0;
  let starPityFails = Array(numStars).fill(0);
  let starAttempts = Array(numStars).fill(0);

  const handleFailReset = () => {
    if (starPityResetsOnAnyFail) {
      starPityFails = Array(numStars).fill(0);
    }
  };

  let currentStars = 0;
  while (currentStars < numStars) {
    const i = currentStars;
    attempts += 1;
    gold += goldPerAttempt;
    starAttempts[i] += 1; // count this star attempt

    const guaranteed = starPityFails[i] >= starPityThreshold;
    const success = guaranteed || rand() < starProbs[i];
    if (success) {
      currentStars += 1;
      starPityFails[i] = 0;
    } else {
      starPityFails[i] += 1;
      handleFailReset();
      currentStars = 0;
    }
  }
  return { attempts, gold, starAttempts };
}

// ------------------------------------------------------------
// Deterministic Worst‑Case (Full Pity) Calculators (generalized)
// ------------------------------------------------------------
function worstCaseStarsOnly(params) {
  const { goldPerAttempt, starPityThreshold, starPityResetsOnAnyFail, numStars } = params;
  if (starPityResetsOnAnyFail) return { attempts: Infinity, gold: Infinity };

  let starPityFails = Array(numStars).fill(0);
  let attempts = 0;
  let currentStars = 0;

  while (currentStars < numStars) {
    const i = currentStars;
    const guaranteed = starPityFails[i] >= starPityThreshold;
    attempts += 1;
    if (guaranteed) {
      // success at pity
      starPityFails[i] = 0;
      currentStars += 1;
    } else {
      // fail, pity accumulates for this star, and progress wipes
      starPityFails[i] += 1;
      currentStars = 0;
    }
  }
  return { attempts, gold: attempts * goldPerAttempt };
}

function worstCaseFull(params) {
  const { goldPerAttempt, starPityThreshold, finalPityThreshold, starPityResetsOnAnyFail, numStars } = params;
  if (starPityResetsOnAnyFail) return { attempts: Infinity, gold: Infinity };

  let starPityFails = Array(numStars).fill(0);
  let finalPityFails = 0;
  let attempts = 0;

  for (;;) {
    // build stars adversarially
    let currentStars = 0;
    while (currentStars < numStars) {
      const i = currentStars;
      const guaranteed = starPityFails[i] >= starPityThreshold;
      attempts += 1;
      if (guaranteed) {
        starPityFails[i] = 0;
        currentStars += 1;
      } else {
        starPityFails[i] += 1;
        currentStars = 0;
      }
    }

    // final attempt adversarially
    const finalGuaranteed = finalPityFails >= finalPityThreshold;
    attempts += 1;
    if (finalGuaranteed) {
      return { attempts, gold: attempts * goldPerAttempt };
    }
    // fail, stars wiped
    finalPityFails += 1;
  }
}

// ------------------------------------------------------------
// UI Helpers
// ------------------------------------------------------------
function InfoIcon({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        aria-label="Info"
        className="inline-flex items-center text-gray-400 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200 focus:outline-none"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        <Info size={14} />
      </button>
      {open && (
        <span className="absolute z-20 left-1/2 -translate-x-1/2 mt-6 w-56 rounded-lg bg-black/90 text-white text-xs p-2 shadow-lg">{text}</span>
      )}
    </span>
  );
}

function SummaryTable({ title, titleInfo, rows, dark }) {
  return (
    <div className={dark ? "rounded-2xl shadow p-5 bg-neutral-800" : "rounded-2xl shadow p-5 bg-white"}>
      <h3 className="text-xl font-semibold mb-3">
        {title}
        {titleInfo && <InfoIcon text={titleInfo} />}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className={dark ? "text-left border-b border-neutral-700" : "text-left border-b"}>
              {Object.keys(rows[0] || {}).map((k) => (
                <th key={k} className={dark ? "py-2 pr-6 font-medium text-neutral-300" : "py-2 pr-6 font-medium text-gray-600"}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className={dark ? "border-b border-neutral-800" : "border-b/50"}>
                {Object.entries(r).map(([k, v], i) => (
                  <td key={i} className="py-2 pr-6 whitespace-nowrap">
                    {typeof v === "object" && v !== null && "value" in v ? (
                      <>
                        {v.value}
                        {v.info && <InfoIcon text={v.info} />}
                      </>
                    ) : (
                      v
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtWorstVal(v) {
  return Number.isFinite(v) ? formatNumber(v) : "Infinite";
}

function summarizePerStar(perStarArrs) {
  const rows = [];
  for (let i = 0; i < perStarArrs.length; i++) {
    const arr = perStarArrs[i] || [];
    const sorted = [...arr].sort((a, b) => a - b);
    const mean = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    rows.push({
      Star: `Star ${i + 1}`,
      Mean: { value: formatNumber(Math.round(mean)), info: "Arithmetic average attempts used on this star." },
      P50: { value: formatNumber(Math.round(percentile(sorted, 0.5))), info: "Median attempts for this star." },
      P90: { value: formatNumber(Math.round(percentile(sorted, 0.9))), info: "90% of runs use at or below this many attempts for this star." },
      P99: { value: formatNumber(Math.round(percentile(sorted, 0.99))), info: "99% of runs use at or below this many attempts for this star." },
    });
  }
  return rows;
}

export default function EnhancementSimulatorApp() {
  // Theme
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("enhance_sim_dark");
      if (saved !== null) return saved === "1";
    } catch {}
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  useEffect(() => {
    try {
      localStorage.setItem("enhance_sim_dark", dark ? "1" : "0");
    } catch {}
  }, [dark]);

  // Inputs
  const [fromLevel, setFromLevel] = useState(18);
  const [starsRequired, setStarsRequired] = useState(suggestedStarsForLevel(18));

  const [goldPerAttempt, setGoldPerAttempt] = useState(170000);
  const [starProbs, setStarProbs] = useState(Array(starsRequired).fill(0.2));
  const [finalProb, setFinalProb] = useState(0.2);
  const [starPityThreshold, setStarPityThreshold] = useState(6);
  const [finalPityThreshold, setFinalPityThreshold] = useState(6);
  const [starPityResetsOnAnyFail, setStarPityResetsOnAnyFail] = useState(false);

  const [trials, setTrials] = useState(20000);
  const [seed, setSeed] = useState(12345);

  const [results, setResults] = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);

  // Helpers to sync starProbs length when star count changes
  const resizeStarProbs = (n) => {
    setStarProbs((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(prev.length ? prev[prev.length - 1] : 0.2);
      return next;
    });
  };

  const runSimulation = () => {
    const numStars = Number(starsRequired);
    const params = {
      goldPerAttempt: Number(goldPerAttempt),
      starProbs: starProbs.slice(0, numStars).map(Number),
      finalProb: Number(finalProb),
      starPityThreshold: Number(starPityThreshold),
      finalPityThreshold: Number(finalPityThreshold),
      starPityResetsOnAnyFail,
      numStars,
    };

    const rng = createLCG(Number(seed) || 1);

    const starsAttempts = [];
    const starsGolds = [];
    const fullAttempts = [];
    const fullGolds = [];

    const starsAttemptsPerStar = Array(numStars)
      .fill(0)
      .map(() => []);
    const fullAttemptsPerStar = Array(numStars)
      .fill(0)
      .map(() => []);

    for (let t = 0; t < Number(trials); t++) {
      const s = simulateStarsOnly(params, rng);
      starsAttempts.push(s.attempts);
      starsGolds.push(s.gold);
      s.starAttempts.forEach((val, idx) => starsAttemptsPerStar[idx].push(val));

      const f = simulateFullRun(params, rng);
      fullAttempts.push(f.attempts);
      fullGolds.push(f.gold);
      f.starAttempts.forEach((val, idx) => fullAttemptsPerStar[idx].push(val));
    }

    const sA = [...starsAttempts].sort((a, b) => a - b);
    const sG = [...starsGolds].sort((a, b) => a - b);
    const fA = [...fullAttempts].sort((a, b) => a - b);
    const fG = [...fullGolds].sort((a, b) => a - b);

    const starsSummary = {
      meanAttempts: starsAttempts.reduce((a, b) => a + b, 0) / starsAttempts.length,
      medianAttempts: percentile(sA, 0.5),
      p90Attempts: percentile(sA, 0.9),
      p99Attempts: percentile(sA, 0.99),
      meanGold: starsGolds.reduce((a, b) => a + b, 0) / starsGolds.length,
      medianGold: percentile(sG, 0.5),
      p90Gold: percentile(sG, 0.9),
      p99Gold: percentile(sG, 0.99),
    };

    const fullSummary = {
      meanAttempts: fullAttempts.reduce((a, b) => a + b, 0) / fullAttempts.length,
      medianAttempts: percentile(fA, 0.5),
      p90Attempts: percentile(fA, 0.9),
      p99Attempts: percentile(fA, 0.99),
      meanGold: fullGolds.reduce((a, b) => a + b, 0) / fullGolds.length,
      medianGold: percentile(fG, 0.5),
      p90Gold: percentile(fG, 0.9),
      p99Gold: percentile(fG, 0.99),
    };

    const wcStars = worstCaseStarsOnly(params);
    const wcFull = worstCaseFull(params);

    const makeHistogram = (arr, binSize) => {
      const map = new Map();
      for (const v of arr) {
        const bin = Math.floor(v / binSize) * binSize;
        map.set(bin, (map.get(bin) || 0) + 1);
      }
      return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]) => ({ attempts: k, runs: v }));
    };

    setResults({
      starsSummary,
      fullSummary,
      starsHistogram: makeHistogram(starsAttempts, 5),
      fullHistogram: makeHistogram(fullAttempts, 5),
      wcStars,
      wcFull,
      params,
      starsPerStarRows: summarizePerStar(starsAttemptsPerStar),
      fullPerStarRows: summarizePerStar(fullAttemptsPerStar),
    });
  };

  const applySuggestedStars = () => {
    const suggested = suggestedStarsForLevel(Number(fromLevel));
    setStarsRequired(suggested);
    resizeStarProbs(suggested);
  };

  const quickSetRate = (r) => {
    const n = Number(starsRequired);
    setStarProbs(Array(n).fill(r));
    setFinalProb(r);
  };

  const toLevel = Number(fromLevel) + 1;

  // Styles depending on theme
  const cls = {
    page: dark ? "min-h-screen bg-neutral-900 text-neutral-100" : "min-h-screen bg-gray-50 text-gray-900",
    card: dark ? "rounded-2xl shadow p-5 bg-neutral-800" : "rounded-2xl shadow p-5 bg-white",
    subtext: dark ? "text-neutral-300" : "text-gray-600",
    muted: dark ? "text-neutral-400" : "text-gray-600",
    tableHead: dark ? "py-2 pr-6 font-medium text-neutral-300" : "py-2 pr-6 font-medium text-gray-600",
    input: dark
      ? "mt-1 rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2 focus:outline-none focus:ring w-full"
      : "mt-1 rounded-xl border px-3 py-2 focus:outline-none focus:ring w-full",
    btnPrimary: dark
      ? "px-5 py-3 rounded-2xl bg-indigo-500 text-white font-medium hover:bg-indigo-400 w-full md:w-auto"
      : "px-5 py-3 rounded-2xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 w-full md:w-auto",
    btnSecondary: dark
      ? "px-5 py-3 rounded-2xl bg-neutral-700 hover:bg-neutral-600 font-medium w-full md:w-auto"
      : "px-5 py-3 rounded-2xl bg-gray-200 hover:bg-gray-300 font-medium w-full md:w-auto",
    headerPreset: dark
      ? "px-3 py-2 rounded-xl bg-neutral-200 text-neutral-900 text-sm hover:bg-white"
      : "px-3 py-2 rounded-xl bg-gray-900 text-white text-sm hover:bg-gray-800",
    borderRow: dark ? "border-b border-neutral-700" : "border-b",
    chartGrid: dark ? "#444" : "#e5e7eb", // grid lines
    chartAxis: dark ? "#d1d5db" : "#374151", // tick text
    chartAxisStroke: dark ? "#525252" : "#e5e7eb", // axis stroke
    barFill: dark ? "#60a5fa" : undefined, // optional override in dark
  };

  return (
    <div className={cls.page}>
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Universal Enhancement Simulator</h1>
            <p className={"mt-1 " + cls.subtext}>
              Simulate building stars and upgrading from +{fromLevel} to +{toLevel} with pity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[0.2, 0.24, 0.27].map((r) => (
              <button
                key={r}
                onClick={() => quickSetRate(r)}
                className={cls.headerPreset}
                title={`Set all success rates to ${(r * 100).toFixed(0)}%`}
              >
                {(r * 100).toFixed(0)}%
              </button>
            ))}
            <button
              aria-label="Toggle dark mode"
              onClick={() => setDark((d) => !d)}
              className={
                dark
                  ? "ml-2 p-2 rounded-xl bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
                  : "ml-2 p-2 rounded-xl bg-white border hover:bg-gray-100"
              }
              title={dark ? "Switch to light" : "Switch to dark"}
            >
              {dark ? <Sun size={18} className="text-yellow-300" /> : <Moon size={18} className="text-gray-700" />}
            </button>
          </div>
        </header>

        {/* Controls */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className={cls.card + " space-y-4"}>
            <h2 className="text-lg font-semibold">Upgrade Settings</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className={"text-xs " + cls.muted}>From Level (L)</label>
                <input type="number" value={fromLevel} onChange={(e) => setFromLevel(Number(e.target.value))} className={cls.input} />
                <div className={"text-xs mt-1 " + cls.muted}>
                  Simulates +{fromLevel} → +{toLevel}
                </div>
              </div>
              <div className="flex flex-col">
                <label className={"text-xs " + cls.muted}>Stars required</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={starsRequired}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(10, Number(e.target.value)));
                    setStarsRequired(n);
                    resizeStarProbs(n);
                  }}
                  className={cls.input}
                />
                <div className={"text-xs mt-1 " + cls.muted}>
                  Suggested: {suggestedStarsForLevel(Number(fromLevel))}{" "}
                  <button onClick={applySuggestedStars} className="underline hover:no-underline">
                    apply
                  </button>
                </div>
              </div>
            </div>

            <h2 className="text-lg font-semibold mt-4">
              Success Rates <InfoIcon text="Per‑star success rates and the final upgrade success rate." />
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: Number(starsRequired) }).map((_, i) => (
                <div key={i} className="flex flex-col">
                  <label className={"text-xs " + cls.muted}>Star {i + 1} rate</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    value={starProbs[i] ?? 0}
                    onChange={(e) => {
                      const copy = starProbs.slice();
                      copy[i] = Number(e.target.value);
                      setStarProbs(copy);
                    }}
                    className={cls.input}
                  />
                </div>
              ))}
              <div className="flex flex-col md:col-span-2">
                <label className={"text-xs " + cls.muted}>
                  Final upgrade rate (+{fromLevel} → +{toLevel})
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  value={finalProb}
                  onChange={(e) => setFinalProb(Number(e.target.value))}
                  className={cls.input}
                />
              </div>
            </div>
          </div>

          <div className={cls.card + " space-y-4"}>
            <h2 className="text-lg font-semibold">
              Economy & Pity <InfoIcon text="Gold per attempt and pity thresholds. After N fails, the next attempt is guaranteed." />
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className={"text-xs " + cls.muted}>Gold per attempt</label>
                <input
                  type="number"
                  min={0}
                  value={goldPerAttempt}
                  onChange={(e) => setGoldPerAttempt(Number(e.target.value))}
                  className={cls.input}
                />
              </div>
              <div className="flex flex-col">
                <label className={"text-xs " + cls.muted}>Star pity threshold (fails)</label>
                <input
                  type="number"
                  min={0}
                  value={starPityThreshold}
                  onChange={(e) => setStarPityThreshold(Number(e.target.value))}
                  className={cls.input}
                />
              </div>
              <div className="flex flex-col">
                <label className={"text-xs " + cls.muted}>Final pity threshold (fails)</label>
                <input
                  type="number"
                  min={0}
                  value={finalPityThreshold}
                  onChange={(e) => setFinalPityThreshold(Number(e.target.value))}
                  className={cls.input}
                />
              </div>
              <div className="flex items-end gap-2">
                <input
                  id="resetPity"
                  type="checkbox"
                  checked={starPityResetsOnAnyFail}
                  onChange={(e) => setStarPityResetsOnAnyFail(e.target.checked)}
                  className="h-5 w-5 rounded"
                />
                <label htmlFor="resetPity" className="text-sm">
                  Reset <span className="font-semibold">all star pity counters</span> on any fail
                  <InfoIcon text="If enabled, star pity cannot accumulate; worst‑case becomes infinite." />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className={cls.card + " grid md:grid-cols-3 gap-4 items-end"}>
          <div className="flex flex-col">
            <label className={"text-xs " + cls.muted}>
              Monte Carlo trials <InfoIcon text="We sample many random runs to estimate averages and percentiles." />
            </label>
            <input type="number" min={100} max={200000} value={trials} onChange={(e) => setTrials(Number(e.target.value))} className={cls.input} />
          </div>
          <div className="flex flex-col">
            <label className={"text-xs " + cls.muted}>
              Random seed <InfoIcon text="Same seed → same pseudo‑random sequence → reproducible results." />
            </label>
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className={cls.input} />
          </div>
          <div className="flex gap-3 md:justify-end">
            <button onClick={runSimulation} className={cls.btnPrimary}>
              Run Simulation
            </button>
            <button
              onClick={() => {
                setFromLevel(18);
                const sug = suggestedStarsForLevel(18);
                setStarsRequired(sug);
                resizeStarProbs(sug);
                setGoldPerAttempt(170000);
                setStarProbs(Array(sug).fill(0.2));
                setFinalProb(0.2);
                setStarPityThreshold(6);
                setFinalPityThreshold(6);
                setStarPityResetsOnAnyFail(false);
                setTrials(20000);
                setSeed(12345);
                setResults(null);
              }}
              className={cls.btnSecondary}
            >
              Reset
            </button>
          </div>
        </section>

        {results && (
          <section className="space-y-6">
            {/* Summaries */}
            <div className="grid md:grid-cols-2 gap-6">
              <SummaryTable
                dark={dark}
                title={`Build ${results.params.numStars} Stars — Monte Carlo`}
                titleInfo="Averages and percentiles from simulation."
                rows={[
                  {
                    Metric: "Mean Attempts",
                    Value: { value: formatNumber(Math.round(results.starsSummary.meanAttempts)), info: "Arithmetic average across runs." },
                  },
                  {
                    Metric: "P50 (Median) Attempts",
                    Value: { value: formatNumber(Math.round(results.starsSummary.medianAttempts)), info: "Half of runs finish at or below this." },
                  },
                  {
                    Metric: "P90 Attempts",
                    Value: { value: formatNumber(Math.round(results.starsSummary.p90Attempts)), info: "90% of runs finish at or below this." },
                  },
                  {
                    Metric: "P99 Attempts",
                    Value: { value: formatNumber(Math.round(results.starsSummary.p99Attempts)), info: "99% of runs finish at or below this." },
                  },
                  { Metric: "Mean Gold", Value: { value: formatGold(results.starsSummary.meanGold), info: "Mean attempts × gold per attempt." } },
                  { Metric: "P50 (Median) Gold", Value: { value: formatGold(results.starsSummary.medianGold), info: "Gold at median attempts." } },
                  { Metric: "P90 Gold", Value: { value: formatGold(results.starsSummary.p90Gold), info: "Gold at 90th percentile attempts." } },
                  { Metric: "P99 Gold", Value: { value: formatGold(results.starsSummary.p99Gold), info: "Gold at 99th percentile attempts." } },
                ]}
              />

              <SummaryTable
                dark={dark}
                title={`Upgrade +${fromLevel} → +${toLevel} — Monte Carlo`}
                titleInfo="Includes rebuilding stars between failed finals."
                rows={[
                  {
                    Metric: "Mean Attempts",
                    Value: { value: formatNumber(Math.round(results.fullSummary.meanAttempts)), info: "Arithmetic average across runs." },
                  },
                  {
                    Metric: "P50 (Median) Attempts",
                    Value: { value: formatNumber(Math.round(results.fullSummary.medianAttempts)), info: "Half of runs finish at or below this." },
                  },
                  {
                    Metric: "P90 Attempts",
                    Value: { value: formatNumber(Math.round(results.fullSummary.p90Attempts)), info: "90% of runs finish at or below this." },
                  },
                  {
                    Metric: "P99 Attempts",
                    Value: { value: formatNumber(Math.round(results.fullSummary.p99Attempts)), info: "99% of runs finish at or below this." },
                  },
                  { Metric: "Mean Gold", Value: { value: formatGold(results.fullSummary.meanGold), info: "Mean attempts × gold per attempt." } },
                  { Metric: "P50 (Median) Gold", Value: { value: formatGold(results.fullSummary.medianGold), info: "Gold at median attempts." } },
                  { Metric: "P90 Gold", Value: { value: formatGold(results.fullSummary.p90Gold), info: "Gold at 90th percentile attempts." } },
                  { Metric: "P99 Gold", Value: { value: formatGold(results.fullSummary.p99Gold), info: "Gold at 99th percentile attempts." } },
                ]}
              />
            </div>

            {/* Per‑star attempts */}
            <div className="grid md:grid-cols-2 gap-6">
              <SummaryTable
                dark={dark}
                title="Per‑Star Attempts — Build Phase"
                titleInfo="Number of times each specific star was attempted until all stars were built. Earlier stars tend to be tried more due to resets."
                rows={results.starsPerStarRows}
              />
              <SummaryTable
                dark={dark}
                title="Per‑Star Attempts — Full Upgrade"
                titleInfo="Across the entire run to the final upgrade (including rebuilds between failed finals)."
                rows={results.fullPerStarRows}
              />
            </div>

            {/* Worst‑case */}
            <div className="grid md:grid-cols-2 gap-6">
              <SummaryTable
                dark={dark}
                title={`Build ${results.params.numStars} Stars — Worst Case (Full Pity)`}
                titleInfo="Adversarial luck: every try fails unless guaranteed by pity."
                rows={[
                  { Metric: "Attempts", Value: { value: fmtWorstVal(results.wcStars.attempts), info: "Infinite if star pity resets each fail." } },
                  {
                    Metric: "Gold",
                    Value: {
                      value: Number.isFinite(results.wcStars.gold) ? formatGold(results.wcStars.gold) : "Infinite",
                      info: "Attempts × gold per attempt.",
                    },
                  },
                ]}
              />

              <SummaryTable
                dark={dark}
                title={`Upgrade +${fromLevel} → +${toLevel} — Worst Case (Full Pity)`}
                titleInfo="Includes repeated rebuilds and final pity that persists."
                rows={[
                  { Metric: "Attempts", Value: { value: fmtWorstVal(results.wcFull.attempts), info: "Infinite if star pity resets each fail." } },
                  {
                    Metric: "Gold",
                    Value: {
                      value: Number.isFinite(results.wcFull.gold) ? formatGold(results.wcFull.gold) : "Infinite",
                      info: "Attempts × gold per attempt.",
                    },
                  },
                ]}
              />
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className={cls.card}>
                <h3 className="text-xl font-semibold mb-3">
                  Attempts Distribution — Build Stars <InfoIcon text="Histogram of attempts across Monte Carlo runs." />
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={results.starsHistogram}>
                      <CartesianGrid stroke={cls.chartGrid} strokeDasharray="3 3" />
                      <XAxis dataKey="attempts" tick={{ fill: cls.chartAxis }} stroke={cls.chartAxisStroke} />
                      <YAxis tick={{ fill: cls.chartAxis }} stroke={cls.chartAxisStroke} />
                      <Tooltip formatter={(value) => [value, "runs"]} labelFormatter={(l) => `Attempts ≥ ${l}`} />
                      <Bar dataKey="runs" fill={cls.barFill} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={cls.card}>
                <h3 className="text-xl font-semibold mb-3">
                  Attempts Distribution — Final Upgrade <InfoIcon text="Histogram of attempts across Monte Carlo runs." />
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={results.fullHistogram}>
                      <CartesianGrid stroke={cls.chartGrid} strokeDasharray="3 3" />
                      <XAxis dataKey="attempts" tick={{ fill: cls.chartAxis }} stroke={cls.chartAxisStroke} />
                      <YAxis tick={{ fill: cls.chartAxis }} stroke={cls.chartAxisStroke} />
                      <Tooltip formatter={(value) => [value, "runs"]} labelFormatter={(l) => `Attempts ≥ ${l}`} />
                      <Bar dataKey="runs" fill={cls.barFill} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Diagnostics */}
            <div className={cls.card}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-semibold">Diagnostics</h3>
                <InfoIcon text="Quick sanity checks to verify core logic." />
              </div>
              <button
                onClick={() => {
                  const out = [];

                  const gold = 100;

                  // Test 1: p=1 everywhere
                  {
                    const params = {
                      goldPerAttempt: gold,
                      starProbs: [1, 1, 1],
                      finalProb: 1,
                      starPityThreshold: 6,
                      finalPityThreshold: 6,
                      starPityResetsOnAnyFail: false,
                      numStars: 3,
                    };
                    const rng = createLCG(1);
                    const s = simulateStarsOnly(params, rng);
                    const f = simulateFullRun(params, rng);
                    const perStarOk =
                      JSON.stringify(s.starAttempts) === JSON.stringify([1, 1, 1]) && JSON.stringify(f.starAttempts) === JSON.stringify([1, 1, 1]);
                    out.push({
                      name: "p=1 deterministic (3 stars)",
                      pass: s.attempts === 3 && f.attempts === 4 && perStarOk,
                      detail: `stars=${s.attempts} (exp 3), full=${f.attempts} (exp 4), perStarOK=${perStarOk}`,
                    });
                  }

                  // Test 2: p=0 equals worst‑case (2 stars, pity=2)
                  {
                    const params = {
                      goldPerAttempt: gold,
                      starProbs: [0, 0],
                      finalProb: 0,
                      starPityThreshold: 2,
                      finalPityThreshold: 2,
                      starPityResetsOnAnyFail: false,
                      numStars: 2,
                    };
                    const rng = createLCG(42);
                    const f = simulateFullRun(params, rng);
                    const wc = worstCaseFull(params);
                    out.push({
                      name: "p=0 equals worst‑case (2 stars)",
                      pass: f.attempts === wc.attempts,
                      detail: `full=${f.attempts}, worst=${wc.attempts}`,
                    });
                  }

                  setDiagnostics(out);
                }}
                className={
                  dark
                    ? "px-4 py-2 rounded-xl bg-neutral-200 text-neutral-900 text-sm hover:bg-white"
                    : "px-4 py-2 rounded-xl bg-gray-900 text-white text-sm hover:bg-gray-800"
                }
              >
                Run Diagnostics
              </button>
              <ul className="mt-3 space-y-2 text-sm">
                {diagnostics.map((d, i) => (
                  <li key={i} className={d.pass ? "text-green-600" : "text-red-600"}>
                    <span className="font-medium">{d.pass ? "PASS" : "FAIL"}</span> — {d.name}: {d.detail}
                  </li>
                ))}
                {diagnostics.length === 0 && <li className={cls.muted}>No diagnostics run yet.</li>}
              </ul>
            </div>
          </section>
        )}

        {!results && (
          <div className={cls.card}>
            <p className={dark ? "text-neutral-200" : "text-gray-700"}>
              Set <span className="font-semibold">From Level</span> and <span className="font-semibold">Stars required</span>, then click{" "}
              <span className="font-semibold">Run Simulation</span> to see averages, percentiles
              <InfoIcon text="P50 = median, P90/P99 = 90th/99th percentiles." />, per‑star attempts
              <InfoIcon text="How many times each specific star is attempted in a run." />, worst‑case (full pity)
              <InfoIcon text="Assumes every non‑guaranteed attempt fails." /> and distribution charts.
            </p>
          </div>
        )}

        <footer className={"text-xs pb-6 " + cls.muted}>
          Built as a single‑file React app. Styling via Tailwind; charts via Recharts; icons via lucide‑react.
        </footer>
      </div>
    </div>
  );
}
