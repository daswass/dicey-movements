import { describe, expect, it } from "vitest";
import { shouldApplyProfileTimerDefault } from "./timerHydrationLogic";

describe("shouldApplyProfileTimerDefault", () => {
  it("does not mark a fresh mobile reload as ready before authoritative hydration", () => {
    expect(
      shouldApplyProfileTimerDefault({
        hydrated: false,
        isTimerActive: false,
        timeLeft: 0,
        duration: 300,
        openedFromNotification: false,
      })
    ).toBe(false);
  });

  it("allows the profile default only after hydration confirms there is no active timer", () => {
    expect(
      shouldApplyProfileTimerDefault({
        hydrated: true,
        isTimerActive: false,
        timeLeft: 0,
        duration: 300,
        openedFromNotification: false,
      })
    ).toBe(true);
  });
});
