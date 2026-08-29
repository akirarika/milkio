import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { progress, getRate } from "./index.ts";

vi.mock("consola", () => ({
  default: {
    start: () => {},
    success: () => {},
    info: () => {},
    error: () => {},
  },
}));

function reset() {
  progress.usingStages = false;
  progress.totalUnits = 0;
  progress.scopes = new Map();
  progress.time = 0;
  progress.rate = 0;
  progress.current = 0;
  progress.lastRenderedPermille = -1;
  progress.lastRenderAt = 0;
}

describe("progress stage engine", () => {
  beforeEach(() => {
    reset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("accumulates stage weights and reports the exact percent", () => {
    progress.configure({ totalUnits: 100 });

    progress.stage("p", "scan", 3);
    progress.update();
    // before any time passes, an unknown-total stage contributes creep=0
    expect(progress.rate).toBe(0);

    // starting the next stage completes the previous one (scan=3)
    progress.stage("p", "gen", 10);
    progress.update();
    expect(progress.rate).toBe(30); // 3% -> 30 permille

    progress.setTotal("p", 5);
    progress.tick("p", 2);
    progress.update();
    expect(progress.rate).toBe(70); // 3 + 10 * (2/5) = 7% -> 70 permille
  });

  it("advances by done/total inside a stage (real progress)", () => {
    progress.configure({ totalUnits: 100 });

    progress.stage("p", "typia", 40);
    progress.setTotal("p", 4);
    progress.tick("p", 1);
    progress.update();
    expect(getRate()).toBe("10.0%"); // 40 * (1/4) = 10%

    progress.tick("p", 3);
    progress.update();
    expect(getRate()).toBe("40.0%"); // stage fully done

    progress.completeStage("p");
    progress.update();
    expect(getRate()).toBe("40.0%"); // completed weight retained
  });

  it("isolates concurrent project scopes", () => {
    progress.configure({ totalUnits: 200 });

    progress.stage("A", "scan", 3);
    progress.stage("B", "scan", 3);
    progress.update();
    expect(getRate()).toBe("0.0%");

    progress.completeStage("A");
    progress.stage("A", "gen", 10);
    progress.completeStage("B");
    progress.stage("B", "gen", 10);
    progress.update();
    expect(getRate()).toBe("3.0%"); // (3 + 3) / 200

    progress.setTotal("A", 2);
    progress.tick("A", 1);
    progress.update();
    expect(getRate()).toBe("5.5%"); // (3 + 5 + 3) / 200

    progress.completeStage("A");
    progress.update();
    expect(getRate()).toBe("8.0%"); // (13 + 3) / 200
  });

  it("creeps toward the stage cap during an unknown-total phase without exceeding its weight", () => {
    vi.useFakeTimers();

    progress.open("building");
    progress.configure({ totalUnits: 100 });
    progress.stage("p", "scan", 3);

    vi.advanceTimersByTime(2000);

    // creep approaches but never reaches 1, so the stage contribution stays < 3% (30 permille)
    expect(progress.rate).toBeGreaterThan(0);
    expect(progress.rate).toBeLessThan(30);

    vi.clearAllTimers();
  });

  it("uses time-based creep as fallback when no stage plan is configured", () => {
    progress.time = 4800;
    progress.update();

    // 1 - e^-1 ≈ 0.632 -> ~632 permille
    expect(progress.rate).toBeGreaterThan(600);
    expect(progress.rate).toBeLessThan(660);
  });
});

describe("getRate", () => {
  it("formats permille to a one-decimal percent string", () => {
    progress.rate = 50;
    expect(getRate()).toBe("5.0%");

    progress.rate = 1000;
    expect(getRate()).toBe("100.0%");

    progress.rate = 1001;
    expect(getRate()).toBe("100.0%");
  });
});
