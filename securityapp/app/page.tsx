"use client";

import { useEffect, useMemo, useState } from "react";
import type { GuardLength, Location, RotationRow, ShiftType } from "@/lib/rotation-engine";
import { buildRotation, recommendStart, allGuardsIdentical, getStartingGuardsCount, getAvailablePositions, getEndingPost } from "@/lib/rotation-engine";
import dynamic from "next/dynamic";

const EggLottery = dynamic(() => import("./components/EggLottery"), { ssr: false });

const LOCATION_OPTIONS: Location[] = ["\u05D0\u05D3\u05D5\u05DD", "\u05DB\u05D7\u05D5\u05DC", "\u05E8\u05D7\u05D1\u05D4", "\u05DC\u05D9\u05D5\u05D5\u05D9", "\u05D7\u05D5\u05E4\u05E9\u05D9"];
const LOCATION_BOOKMARK_CLASSES: Record<Location, string> = {
  "\u05D0\u05D3\u05D5\u05DD": "bg-red-700",
  "\u05DB\u05D7\u05D5\u05DC": "bg-blue-700",
  "\u05E8\u05D7\u05D1\u05D4": "bg-yellow-600",
  "\u05DC\u05D9\u05D5\u05D5\u05D9": "bg-orange-500",
  "\u05D7\u05D5\u05E4\u05E9\u05D9": "bg-emerald-700",
};

function isFreeLike(station: Location): boolean {
  return station === "\u05D7\u05D5\u05E4\u05E9\u05D9" || station === "\u05DC\u05D9\u05D5\u05D5\u05D9";
}

export default function Home() {
  const [shiftType, setShiftType] = useState<ShiftType>("morning");
  const [longGuards, setLongGuards] = useState<number>(3);
  const [shortGuards, setShortGuards] = useState<number>(2);
  const [afternoonIncomingGuards, setAfternoonIncomingGuards] = useState<number>(0);
  const [userLength, setUserLength] = useState<GuardLength>("long");
  const [startingPosition, setStartingPosition] = useState<Location>("\u05D0\u05D3\u05D5\u05DD");
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
    if (loc === "\u05E8\u05D7\u05D1\u05D4" && isPlazaDisabled) {
      return false;
    }
    if (loc === "\u05DC\u05D9\u05D5\u05D5\u05D9" && isEscortDisabled) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if ((isPlazaDisabled && startingPosition === "\u05E8\u05D7\u05D1\u05D4") || (isEscortDisabled && startingPosition === "\u05DC\u05D9\u05D5\u05D5\u05D9")) {
      setStartingPosition("\u05D0\u05D3\u05D5\u05DD");
    }
  }, [isPlazaDisabled, isEscortDisabled, startingPosition]);

  useEffect(() => {
    setLotteryResults(null);
  }, [shiftType, longGuards, shortGuards, afternoonIncomingGuards, userLength]);

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
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setRows([]);
      setError(message);
    }
  }

  function performLottery() {
    try {
      const guardsOnDutyAtStart = getStartingGuardsCount(
        shiftType,
        longGuards,
        shortGuards,
        afternoonIncomingGuards,
        userLength
      );

      const availableStartPositions = getAvailablePositions(guardsOnDutyAtStart);
      const shuffledStartPositions = [...availableStartPositions].sort(() => Math.random() - 0.5);

      const results: Record<string, { start: Location; end: Location }> = {};
      for (let i = 0; i < totalGuards; i++) {
        const guardName = guardNames[i]?.trim();
        const displayName = guardName || `Guard ${i + 1}`;

        if (i < shuffledStartPositions.length) {
          const startPosition = shuffledStartPositions[i];

          const actualRotation = buildRotation({
            shiftType,
            longGuards,
            shortGuards,
            afternoonIncomingGuards,
            userLength,
            startingPosition: startPosition,
            useLottery: false,
          });

          const endPosition = actualRotation.length > 0 ? actualRotation[actualRotation.length - 1].station : startPosition;

          results[displayName] = {
            start: startPosition,
            end: endPosition
          };
        }
      }

      setLotteryResults(results);
      setShowReveal(false);

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
    <main className="min-h-screen min-h-dvh px-3 py-4 text-cyan-100 sm:px-4 sm:py-8" style={{contain: 'layout'}}>
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-2xl border border-cyan-400/20 bg-[#0b1427]/95 p-3 shadow-sm sm:p-5 md:p-8">
          <header className="mb-4 sm:mb-6">
            <h1 className="text-xl font-bold tracking-tight text-cyan-200 sm:text-2xl md:text-3xl">Security Rotation Console</h1>
            <p className="mt-1.5 text-xs text-cyan-100/70 sm:text-sm">
              Shift planner for guards with dynamic 5/4/3 manpower transitions.
            </p>
          </header>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
              <span className="mb-1.5 block text-xs text-cyan-100/80 sm:text-sm sm:mb-2">Shift Type</span>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as ShiftType)}
                className="w-full rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-2.5 text-base outline-none ring-cyan-300 transition focus:ring-2"
              >
                <option value="morning">Morning</option>
                <option value="night">Night</option>
              </select>
            </label>

            <label className="rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
              <span className="mb-1.5 block text-xs text-cyan-100/80 sm:text-sm sm:mb-2">Your Shift Length</span>
              <select
                value={userLength}
                onChange={(e) => setUserLength(e.target.value as GuardLength)}
                className="w-full rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-2.5 text-base outline-none ring-cyan-300 transition focus:ring-2"
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </label>

            <div className="md:col-span-2 flex flex-wrap items-start gap-2 sm:gap-3">
              <label className="flex-1 min-w-[7rem] rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
                <span className="mb-1.5 block text-xs text-cyan-100/80 sm:text-sm sm:mb-2">Long Guards</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={longGuards}
                  onChange={(e) => setLongGuards(Number(e.target.value))}
                  className="w-full rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-2.5 text-base outline-none ring-cyan-300 transition focus:ring-2"
                />
              </label>

              <label className="flex-1 min-w-[7rem] rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
                <span className="mb-1.5 block text-xs text-cyan-100/80 sm:text-sm sm:mb-2">Short Guards</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={shortGuards}
                  onChange={(e) => setShortGuards(Number(e.target.value))}
                  className="w-full rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-2.5 text-base outline-none ring-cyan-300 transition focus:ring-2"
                />
              </label>

              {showAfternoonGuardsInput && (
                <label className="flex-1 min-w-[7rem] rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
                  <span className="mb-1.5 block text-xs text-cyan-100/80 sm:text-sm sm:mb-2">Afternoon</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={afternoonIncomingGuards}
                    onChange={(e) => setAfternoonIncomingGuards(Number(e.target.value))}
                    className="w-full rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-2.5 text-base outline-none ring-cyan-300 transition focus:ring-2"
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
                  <span className="block text-sm font-semibold text-cyan-100">Roulette Mode</span>
                  <span className="block text-xs text-cyan-100/60">Randomly assign positions for each time slot</span>
                </div>
              </label>
            )}

            {useLottery && isAllGuardsIdentical && (
              <div className="w-full rounded-2xl border border-cyan-300/15 bg-white/5 p-3 sm:p-4 md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-cyan-100 sm:mb-3">Guard Names</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                      className="rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-2 text-base outline-none ring-cyan-300 transition focus:ring-2 text-cyan-100"
                    />
                  ))}
                </div>
              </div>
            )}

            <label className={`w-full rounded-2xl border border-cyan-300/15 bg-white/5 p-3 md:mx-auto md:w-fit md:col-span-2 ${useLottery ? "opacity-50 pointer-events-none" : ""}`}>
              <span className="mb-1.5 block text-xs text-cyan-100/80 sm:text-sm sm:mb-2">Starting Position</span>
              <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:justify-center sm:gap-2 md:gap-3 pb-1">
                {LOCATION_OPTIONS.map((loc) => {
                  const isDisabled =
                    (loc === "\u05E8\u05D7\u05D1\u05D4" && isPlazaDisabled) || (loc === "\u05DC\u05D9\u05D5\u05D5\u05D9" && isEscortDisabled);
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
                          ? loc === "\u05E8\u05D7\u05D1\u05D4"
                            ? "\u05E8\u05D7\u05D1\u05D4 \u05D6\u05DE\u05D9\u05E0\u05D4 \u05E8\u05E7 \u05DB\u05E9\u05D9\u05E9 5 \u05E9\u05D5\u05DE\u05E8\u05D9\u05DD \u05D1\u05EA\u05D7\u05D9\u05DC\u05EA \u05D4\u05DE\u05E9\u05DE\u05E8\u05EA"
                            : "\u05DC\u05D9\u05D5\u05D5\u05D9 \u05D6\u05DE\u05D9\u05DF \u05E8\u05E7 \u05DB\u05E9\u05D9\u05E9 4 \u05D0\u05D5 5 \u05E9\u05D5\u05DE\u05E8\u05D9\u05DD \u05D1\u05EA\u05D7\u05D9\u05DC\u05EA \u05D4\u05DE\u05E9\u05DE\u05E8\u05EA"
                          : undefined
                      }
                      className={`relative rounded-xl border px-2.5 py-2.5 text-sm focus:outline-none active:scale-95 sm:min-w-[5.5rem] sm:px-3 sm:py-3 md:min-w-[6.75rem] md:px-4 md:text-base ${
                        isDisabled
                          ? "cursor-not-allowed border-zinc-600/70 bg-zinc-700/25 text-zinc-400"
                          : isSelected
                          ? "border-cyan-300 bg-cyan-400/20"
                          : "border-cyan-300/30 bg-[#0b1427] hover:bg-cyan-900/20"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute right-1 top-1 h-2 w-2 rounded-sm sm:right-1.5 sm:top-1.5 sm:h-2.5 sm:w-2.5 ${
                          isDisabled ? "bg-zinc-500" : LOCATION_BOOKMARK_CLASSES[loc]
                        }`}
                      />
                      {loc}
                    </button>
                  );
                })}
              </div>
            </label>
          </section>

          <button
            type="button"
            onClick={handleCalculate}
            className="mt-4 w-full rounded-2xl border border-cyan-200/50 bg-cyan-400/20 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-sm hover:bg-cyan-300/25 active:scale-[0.98] sm:w-auto sm:px-6"
          >
            Calculate Rotation
          </button>

          <div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-3 sm:gap-3">
            <div className="col-span-2 sm:col-span-2 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-slate-950/70 to-emerald-500/10 p-3 ring-1 ring-cyan-300/15 sm:p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/60 sm:text-xs">Finishes Free</p>
              <p className="mt-1.5 text-lg font-extrabold text-cyan-100 leading-tight text-center sm:mt-3 sm:text-3xl md:text-4xl">
                {startsThatFinishFree.length > 0 ? (
                  startsThatFinishFree.map((station, index) => (
                    <span key={station}>
                      <span className={station === "\u05D7\u05D5\u05E4\u05E9\u05D9" ? "font-serif" : ""}>
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
            <div className="col-span-2 sm:col-span-1 rounded-2xl bg-[#06121f] p-3 ring-1 ring-cyan-300/10">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-100/50 sm:text-xs">Field Posts</p>
              <p className="mt-1.5 text-lg font-semibold text-cyan-100 sm:mt-3 sm:text-3xl">{rows.length > 0 ? totalFieldPosts : "N/A"}</p>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
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

        {lotteryResults && Object.keys(lotteryResults).length > 0 && !showAnimation && (
          <section className="mt-3 rounded-2xl border border-emerald-400/20 bg-slate-950/80 p-3 shadow-sm sm:mt-6 sm:rounded-3xl sm:p-6">
            <h2 className="text-base font-semibold text-emerald-200 mb-2.5 sm:text-xl sm:mb-4">Guard Finish Posts</h2>
            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
              {Object.entries(lotteryResults).map(([guardName, assignment]) => (
                <div key={guardName} className="flex items-center justify-between rounded-xl border border-cyan-300/10 bg-slate-950/60 px-3 py-2 gap-2 sm:rounded-2xl sm:p-4 sm:flex-col sm:items-stretch">
                  <span className="font-semibold text-white text-sm truncate min-w-0 sm:text-lg sm:mb-2">{guardName}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 sm:gap-3">
                    <div className={`rounded-lg px-2 py-0.5 text-xs font-bold text-white sm:flex-1 sm:rounded-2xl sm:px-4 sm:py-2 sm:text-sm ${LOCATION_BOOKMARK_CLASSES[assignment.start]}`}>
                      {assignment.start}
                    </div>
                    <span className="text-emerald-300/50 text-[10px] font-bold">{"\u2192"}</span>
                    <div className={`rounded-lg px-2 py-0.5 text-xs font-extrabold text-white sm:flex-1 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-base ${LOCATION_BOOKMARK_CLASSES[assignment.end]}`}>
                      {assignment.end}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-3 rounded-2xl border border-cyan-400/20 bg-[#0b1427]/95 p-3 shadow-sm sm:mt-6 sm:p-6">
          <h2 className="mb-2 text-base font-semibold text-cyan-200 sm:mb-3 sm:text-lg">Rotation Timeline</h2>
          <div className="-mx-3 sm:mx-0 overflow-x-auto rounded-xl border border-cyan-300/20">
            <table className="w-full min-w-[420px] border-collapse text-xs sm:text-sm">
              <thead className="bg-cyan-500/10 text-cyan-200">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold sm:px-3 sm:py-3">Time</th>
                  <th className="px-2 py-2 text-left font-semibold sm:px-3 sm:py-3">Station</th>
                  <th className="px-2 py-2 text-left font-semibold sm:px-3 sm:py-3">On Duty</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-cyan-100/70 text-xs sm:py-6 sm:text-sm">
                      Press <span className="font-semibold text-cyan-300">Calculate</span> to view schedule.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`${row.timeRange}-${index}`}
                      className="border-t border-cyan-300/10 odd:bg-[#0c182e]/70 even:bg-[#0a1528]/70"
                    >
                      <td className="px-2 py-2 sm:px-3 sm:py-3 whitespace-nowrap">{row.timeRange}</td>
                      <td className="px-2 py-2 sm:px-3 sm:py-3">
                        <div className={`rounded-md border border-cyan-200/30 bg-cyan-400/10 px-1.5 py-0.5 text-center sm:rounded-lg sm:px-2 sm:py-1 ${LOCATION_BOOKMARK_CLASSES[row.station]}`}>
                          {row.station}
                        </div>
                      </td>
                      <td className="px-2 py-2 sm:px-3 sm:py-3 text-center">{row.guardsOnDuty}</td>
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
