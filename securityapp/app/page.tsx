"use client";

import { useEffect, useMemo, useState } from "react";
import type { GuardLength, Location, RotationRow, ShiftType } from "@/lib/rotation-engine";
import { buildRotation, recommendStart, allGuardsIdentical, getStartingGuardsCount, getAvailablePositions, getEndingPost } from "@/lib/rotation-engine";
import dynamic from "next/dynamic";

const EggLottery = dynamic(() => import("./components/EggLottery"), { ssr: false });

const LOCATION_OPTIONS: Location[] = ["אדום", "כחול", "רחבה", "ליווי", "חופשי"];
const LOCATION_BOOKMARK_CLASSES: Record<Location, string> = {
  אדום: "bg-red-700",
  כחול: "bg-blue-700",
  רחבה: "bg-yellow-600",
  ליווי: "bg-orange-500",
  חופשי: "bg-emerald-700",
};

function isFreeLike(station: Location): boolean {
  return station === "חופשי" || station === "ליווי";
}

export default function Home() {
  const [shiftType, setShiftType] = useState<ShiftType>("morning");
  const [longGuards, setLongGuards] = useState<number>(3);
  const [shortGuards, setShortGuards] = useState<number>(2);
  const [afternoonIncomingGuards, setAfternoonIncomingGuards] = useState<number>(0);
  const [userLength, setUserLength] = useState<GuardLength>("long");
  const [startingPosition, setStartingPosition] = useState<Location>("אדום");
  const [rows, setRows] = useState<RotationRow[]>([]);
  const [error, setError] = useState<string>("");
  const [useLottery, setUseLottery] = useState<boolean>(false);
  const [guardNames, setGuardNames] = useState<string[]>([]);
  const [lotteryResults, setLotteryResults] = useState<Record<string, { start: Location; end: Location }> | null>(null);
  const [showAnimation, setShowAnimation] = useState<boolean>(false);
  const [showReveal, setShowReveal] = useState<boolean>(false);
  const showAfternoonGuardsInput =
    userLength === "long" && (shiftType === "morning" || shiftType === "night");
  const guardsAtShiftStart =
    shiftType === "night" && userLength === "long"
      ? longGuards + afternoonIncomingGuards
      : longGuards + shortGuards;
  const isPlazaDisabled = guardsAtShiftStart < 5;
  const isEscortDisabled = guardsAtShiftStart < 4;
  const isAllGuardsIdentical = allGuardsIdentical(longGuards, shortGuards, afternoonIncomingGuards, shiftType, userLength);
  const totalGuards = isAllGuardsIdentical ? longGuards : longGuards + shortGuards;
  const availableStartOptions = LOCATION_OPTIONS.filter((loc) => {
    if (loc === "רחבה" && isPlazaDisabled) {
      return false;
    }
    if (loc === "ליווי" && isEscortDisabled) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if ((isPlazaDisabled && startingPosition === "רחבה") || (isEscortDisabled && startingPosition === "ליווי")) {
      setStartingPosition("אדום");
    }
  }, [isPlazaDisabled, isEscortDisabled, startingPosition]);

  // Clear lottery results when guard configuration changes
  useEffect(() => {
    setLotteryResults(null);
  }, [shiftType, longGuards, shortGuards, afternoonIncomingGuards, userLength]);

  // Clear lottery results when lottery mode is disabled
  useEffect(() => {
    if (!useLottery) {
      setLotteryResults(null);
    }
  }, [useLottery]);

  const recommendedStart = useMemo(() => {
    try {
      return recommendStart({
        shiftType,
        longGuards,
        shortGuards,
        afternoonIncomingGuards,
        userLength,
      });
    } catch {
      return null;
    }
  }, [shiftType, longGuards, shortGuards, afternoonIncomingGuards, userLength]);

  const totalFieldPosts = useMemo(() => {
    return rows.filter((row) => !isFreeLike(row.station)).length;
  }, [rows]);

  const startsThatFinishFree = useMemo(() => {
    return availableStartOptions.filter((start) => {
      try {
        const candidateRows = buildRotation({
          shiftType,
          longGuards,
          shortGuards,
          afternoonIncomingGuards,
          userLength,
          startingPosition: start,
        });
        return candidateRows.length > 0 && isFreeLike(candidateRows[candidateRows.length - 1].station);
      } catch {
        return false;
      }
    });
  }, [shiftType, longGuards, shortGuards, afternoonIncomingGuards, userLength, availableStartOptions]);

  function handleCalculate() {
    setError("");
    try {
      if (useLottery && guardNames.some(name => name.trim())) {
        // Clear previous lottery results when starting a new lottery
        setLotteryResults(null);
        setShowAnimation(true);
        setTimeout(() => {
          performLottery();
        }, 500);
      } else {
        const rotation = buildRotation({
          shiftType,
          longGuards,
          shortGuards,
          afternoonIncomingGuards,
          userLength,
          startingPosition,
          useLottery: false,
        });
        setRows(rotation);
        // Don't clear lottery results for regular calculations
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setRows([]);
      setError(message);
    }
  }

  function performLottery() {
    try {
      // Get the number of guards on duty at the START of the shift
      const guardsOnDutyAtStart = getStartingGuardsCount(
        shiftType,
        longGuards,
        shortGuards,
        afternoonIncomingGuards,
        userLength
      );

      // Get all available starting positions for that number of guards
      const availableStartPositions = getAvailablePositions(guardsOnDutyAtStart);

      // Shuffle the starting positions
      const shuffledStartPositions = [...availableStartPositions].sort(() => Math.random() - 0.5);

      // Assign guards to starting positions
      // For each starting position, build the ACTUAL rotation to see where they end up
      const results: Record<string, { start: Location; end: Location }> = {};
      for (let i = 0; i < totalGuards; i++) {
        const guardName = guardNames[i]?.trim();
        const displayName = guardName || `Guard ${i + 1}`;
        
        if (i < shuffledStartPositions.length) {
          const startPosition = shuffledStartPositions[i];
          
          // Build the actual rotation with this starting position
          const actualRotation = buildRotation({
            shiftType,
            longGuards,
            shortGuards,
            afternoonIncomingGuards,
            userLength,
            startingPosition: startPosition,
            useLottery: false,
          });

          // The ending position is the ACTUAL last station from the rotation engine
          const endPosition = actualRotation.length > 0 ? actualRotation[actualRotation.length - 1].station : startPosition;
          
          results[displayName] = {
            start: startPosition,
            end: endPosition
          };
        }
      }

      setLotteryResults(results);
      setShowReveal(false);

      // Wait 2 seconds for suspense, then reveal
      setTimeout(() => {
        setShowReveal(true);
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setRows([]);
      setError(message);
      setShowAnimation(false);
    }
  }

  function handleAcceptLottery() {
    const rotationData = sessionStorage.getItem('pendingRotation');
    if (rotationData) {
      setRows(JSON.parse(rotationData));
      sessionStorage.removeItem('pendingRotation');
    }
    setShowAnimation(false);
    setLotteryResults(null);
    setShowReveal(false);
  }

  return (
    <main className="min-h-screen px-4 py-8 text-cyan-100" style={{contain: 'layout'}}>
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-2xl border border-cyan-400/20 bg-[#0b1427]/95 p-5 shadow-sm md:p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-cyan-200 md:text-3xl">Security Rotation Console</h1>
            <p className="mt-2 text-sm text-cyan-100/70">
                Shift planner for guards with dynamic 5/4/3 manpower transitions, with end-post finish priority front and center.
            </p>
          </header>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
              <span className="mb-2 block text-sm text-cyan-100/80">Shift Type</span>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as ShiftType)}
                className="w-full rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-3 text-base outline-none ring-cyan-300 transition focus:ring-2"
              >
                <option value="morning">Morning</option>
                <option value="night">Night</option>
              </select>
            </label>

            <label className="rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
              <span className="mb-2 block text-sm text-cyan-100/80">Your Shift Length</span>
              <select
                value={userLength}
                onChange={(e) => setUserLength(e.target.value as GuardLength)}
                className="w-full rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-3 text-base outline-none ring-cyan-300 transition focus:ring-2"
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </label>

            <div className="md:col-span-2 flex flex-wrap items-start gap-3">
              <label className="w-fit rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
                <span className="mb-2 block text-sm text-cyan-100/80">Long Guards</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={longGuards}
                  onChange={(e) => setLongGuards(Number(e.target.value))}
                  className="w-24 rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-3 text-base outline-none ring-cyan-300 transition focus:ring-2"
                />
              </label>

              <label className="w-fit rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
                <span className="mb-2 block text-sm text-cyan-100/80">Short Guards</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={shortGuards}
                  onChange={(e) => setShortGuards(Number(e.target.value))}
                  className="w-24 rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-3 text-base outline-none ring-cyan-300 transition focus:ring-2"
                />
              </label>

              {showAfternoonGuardsInput && (
                <label className="w-fit rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
                  <span className="mb-2 block text-sm text-cyan-100/80">Afternoon Guards</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={afternoonIncomingGuards}
                    onChange={(e) => setAfternoonIncomingGuards(Number(e.target.value))}
                    className="w-24 rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-3 text-base outline-none ring-cyan-300 transition focus:ring-2"
                  />
                </label>
              )}
            </div>

            {isAllGuardsIdentical && (
              <label className="w-full rounded-2xl border border-cyan-300/15 bg-white/5 p-3 md:col-span-2 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLottery}
                  onChange={(e) => setUseLottery(e.target.checked)}
                  className="h-5 w-5 rounded border-cyan-300/30 bg-[#0b1427] cursor-pointer accent-cyan-400"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-cyan-100">🎰 Roulette Mode</span>
                  <span className="block text-xs text-cyan-100/60">All guards are identical - randomly assign positions for each time slot</span>
                </div>
              </label>
            )}

            {useLottery && isAllGuardsIdentical && (
              <div className="w-full rounded-2xl border border-cyan-300/15 bg-white/5 p-4 md:col-span-2">
                <span className="mb-3 block text-sm font-semibold text-cyan-100">Guard Names</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {Array.from({ length: totalGuards }).map((_, index) => (
                    <input
                      key={`guard-${index}`}
                      type="text"
                      placeholder={`Guard ${index + 1}`}
                      value={guardNames[index] || ""}
                      onChange={(e) => {
                        const newNames = [...guardNames];
                        newNames[index] = e.target.value;
                        setGuardNames(newNames);
                      }}
                      className="rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-2 text-sm outline-none ring-cyan-300 transition focus:ring-2 text-cyan-100"
                    />
                  ))}
                </div>
              </div>
            )}

            <label className={`w-full rounded-2xl border border-cyan-300/15 bg-white/5 p-3 md:mx-auto md:w-fit md:col-span-2 ${useLottery ? "opacity-50 pointer-events-none" : ""}`}>
              <span className="mb-2 block text-sm text-cyan-100/80">Starting Position</span>
              <div className="flex flex-wrap justify-center gap-2 pb-1 md:gap-3">
                {LOCATION_OPTIONS.map((loc) => (
                  (() => {
                    const isDisabled =
                      (loc === "רחבה" && isPlazaDisabled) || (loc === "ליווי" && isEscortDisabled);
                    const isSelected = startingPosition === loc;
                    return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      if (!isDisabled) {
                        setStartingPosition(loc);
                      }
                    }}
                    disabled={isDisabled}
                    title={
                      isDisabled
                        ? loc === "רחבה"
                          ? "רחבה זמינה רק כשיש 5 שומרים בתחילת המשמרת"
                          : "ליווי זמין רק כשיש 4 או 5 שומרים בתחילת המשמרת"
                        : undefined
                    }
                    className={`relative min-w-[5.5rem] rounded-xl border px-3 py-3 text-sm focus:outline-none active:scale-95 md:min-w-[6.75rem] md:px-4 md:text-base ${
                      isDisabled
                        ? "cursor-not-allowed border-zinc-600/70 bg-zinc-700/25 text-zinc-400"
                        : isSelected
                        ? "border-cyan-300 bg-cyan-400/20"
                        : "border-cyan-300/30 bg-[#0b1427] hover:bg-cyan-900/20"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-sm ${
                        isDisabled ? "bg-zinc-500" : LOCATION_BOOKMARK_CLASSES[loc]
                      }`}
                    />
                    {loc}
                  </button>
                    );
                  })()
                ))}
              </div>
            </label>
          </section>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.7fr_auto]">
            <div className="rounded-[1.75rem] border border-cyan-400/20 bg-slate-950/85 p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-cyan-100">Finish Post Priority</h2>
                </div>
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80 ring-1 ring-cyan-300/20">
                  Finish post first
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2 rounded-[2rem] bg-gradient-to-br from-cyan-500/20 via-slate-950/70 to-emerald-500/15 p-5 ring-1 ring-cyan-300/15 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/60">Finishes Free</p>
                  <p className="mt-3 text-3xl font-extrabold text-cyan-100 leading-tight text-center sm:text-4xl">
                    {startsThatFinishFree.length > 0 ? (
                      startsThatFinishFree.map((station, index) => (
                        <span key={station}>
                          <span className={station === "חופשי" ? "font-serif" : ""}>
                            {station}
                          </span>
                          {index < startsThatFinishFree.length - 1 ? " & " : ""}
                        </span>
                      ))
                    ) : (
                      "None"
                    )}
                  </p>
                </div>
                <div className="rounded-3xl bg-[#06121f] p-4 ring-1 ring-cyan-300/10">
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/50">Field Posts</p>
                  <p className="mt-3 text-3xl font-semibold text-cyan-100">{rows.length > 0 ? totalFieldPosts : "N/A"}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCalculate}
              className="h-fit rounded-2xl border border-cyan-200/50 bg-cyan-400/20 px-4 py-2.5 text-sm font-semibold text-cyan-100 shadow-sm hover:bg-cyan-300/25 active:scale-[0.98]"
            >
              Calculate Rotation
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          {showAnimation && (
            <EggLottery
              totalGuards={totalGuards}
              guardNames={guardNames}
              lotteryResults={lotteryResults}
              showReveal={showReveal}
              onAccept={handleAcceptLottery}
            />
          )}
        </div>

        {/* Show lottery results after accepting (when modal is closed) */}
        {lotteryResults && Object.keys(lotteryResults).length > 0 && !showAnimation && (
          <section className="mt-6 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-slate-950/80 via-slate-950/70 to-cyan-950/90 p-4 shadow-sm md:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-emerald-200">🎯 Guard Finish Posts</h2>
                <p className="mt-1 text-sm text-emerald-100/70">Highlighting each guard’s final station with a bold finish-card view.</p>
              </div>
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-sm">
                Actual end position shown for every guard
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Object.entries(lotteryResults).map(([guardName, assignment]) => {
                return (
                  <div key={guardName} className="relative overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-slate-950/80 p-5 shadow-sm">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-24" />
                    <div className="relative z-10 flex items-center justify-between gap-4">
                      <span className="text-lg font-semibold text-white">{guardName}</span>
                      <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/80 ring-1 ring-emerald-300/20">
                        Finish Post
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-3xl border border-cyan-300/15 bg-cyan-500/10 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/60">Starts at</p>
                        <div className={`mt-3 rounded-3xl px-4 py-3 text-sm font-semibold text-white ${LOCATION_BOOKMARK_CLASSES[assignment.start]}`}>
                          {assignment.start}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-emerald-300/15 bg-emerald-500/10 p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-emerald-100/60">Finishes at</p>
                        <div className={`mt-3 rounded-3xl px-4 py-4 text-base font-extrabold text-white ${LOCATION_BOOKMARK_CLASSES[assignment.end]}`}>
                          {assignment.end}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-emerald-100/60">Results based on actual rotation calculation</p>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-cyan-400/20 bg-[#0b1427]/95 p-4 shadow-sm md:p-6">
          <h2 className="mb-3 text-lg font-semibold text-cyan-200">Rotation Timeline</h2>
          <p className="mb-4 text-sm text-cyan-100/70">Use this schedule as the operational timeline; the finish-post summary above is the priority output.</p>
          <div className="overflow-x-auto rounded-xl border border-cyan-300/20">
            <table className="w-full min-w-[540px] border-collapse text-sm">
              <thead className="bg-cyan-500/10 text-cyan-200">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Time</th>
                  <th className="px-3 py-3 text-left font-semibold">Station</th>
                  <th className="px-3 py-3 text-left font-semibold">Guards On Duty</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-cyan-100/70">
                      Press <span className="font-semibold text-cyan-300">Calculate Rotation</span> to view schedule.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`${row.timeRange}-${index}`}
                      className="border-t border-cyan-300/10 odd:bg-[#0c182e]/70 even:bg-[#0a1528]/70 hover:bg-cyan-700/10"
                    >
                      <td className="px-3 py-3">{row.timeRange}</td>
                      <td className="px-3 py-3">
                        <div className={`rounded-lg border border-cyan-200/30 bg-cyan-400/10 px-2 py-1 ${LOCATION_BOOKMARK_CLASSES[row.station]}`}>
                          {row.station}
                        </div>
                      </td>
                      <td className="px-3 py-3">{row.guardsOnDuty}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}