import { describe, expect, it } from "vitest";
import {
  computeRemainingSecondsFromSync,
  resolveSyncTimerAction,
} from "./timerSyncLogic";

describe("computeRemainingSecondsFromSync", () => {
  it("returns full duration when timer just started", () => {
    const now = Date.parse("2026-07-04T12:00:00.000Z");
    const startTime = "2026-07-04T12:00:00.000Z";

    expect(computeRemainingSecondsFromSync(startTime, 300, now)).toBe(300);
  });

  it("returns remaining seconds after elapsed time", () => {
    const now = Date.parse("2026-07-04T12:02:30.000Z");
    const startTime = "2026-07-04T12:00:00.000Z";

    expect(computeRemainingSecondsFromSync(startTime, 300, now)).toBe(150);
  });

  it("returns zero when timer has fully elapsed", () => {
    const now = Date.parse("2026-07-04T12:10:00.000Z");
    const startTime = "2026-07-04T12:00:00.000Z";

    expect(computeRemainingSecondsFromSync(startTime, 300, now)).toBe(0);
  });
});

describe("resolveSyncTimerAction", () => {
  const activeState = {
    startTime: "2026-07-04T12:00:00.000Z",
    masterDeviceId: "device-a",
    duration: 300,
  };

  it("resumes inactive client when master timer is running", () => {
    const action = resolveSyncTimerAction({
      state: activeState,
      isTimerActive: false,
      timerComplete: false,
      isMaster: false,
      nowMs: Date.parse("2026-07-04T12:01:00.000Z"),
    });

    expect(action).toEqual({ type: "resume", remainingSeconds: 240 });
  });

  it("marks timer complete when synced state has elapsed", () => {
    const action = resolveSyncTimerAction({
      state: activeState,
      isTimerActive: false,
      timerComplete: false,
      isMaster: false,
      nowMs: Date.parse("2026-07-04T12:10:00.000Z"),
    });

    expect(action).toEqual({ type: "complete" });
  });

  it("clears local timer after reset clears start time on master", () => {
    const action = resolveSyncTimerAction({
      state: {
        startTime: null,
        masterDeviceId: null,
        duration: 300,
      },
      isTimerActive: true,
      timerComplete: false,
      isMaster: true,
    });

    expect(action).toEqual({ type: "clear" });
  });

  it("does not resume when start time was cleared by reset", () => {
    const action = resolveSyncTimerAction({
      state: {
        startTime: null,
        masterDeviceId: null,
        duration: 300,
      },
      isTimerActive: false,
      timerComplete: false,
      isMaster: false,
    });

    expect(action).toEqual({ type: "noop" });
  });
});
