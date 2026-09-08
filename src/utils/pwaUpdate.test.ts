import { describe, expect, it, vi } from "vitest";
import { registerPwaUpdates } from "./pwaUpdate";

function makeRegistration(waiting: ServiceWorker | null) {
  const listeners = new Map<string, () => void>();
  return {
    waiting,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((type: string, listener: () => void) => listeners.set(type, listener)),
  } as unknown as ServiceWorkerRegistration;
}

describe("registerPwaUpdates", () => {
  it("offers a waiting update but does not activate or reload until the user applies it", async () => {
    const waiting = { postMessage: vi.fn() } as unknown as ServiceWorker;
    const registration = makeRegistration(waiting);
    const controllerChange = vi.fn();
    const serviceWorker = {
      controller: {} as ServiceWorker,
      register: vi.fn().mockResolvedValue(registration),
      addEventListener: vi.fn((type: string, listener: () => void) => {
        if (type === "controllerchange") controllerChange.mockImplementation(listener);
      }),
      removeEventListener: vi.fn(),
    };
    const onUpdateAvailable = vi.fn();
    const reload = vi.fn();

    const controller = registerPwaUpdates({ serviceWorker, onUpdateAvailable, reload });
    await Promise.resolve();
    await Promise.resolve();

    expect(onUpdateAvailable).toHaveBeenCalledWith(registration);
    expect(waiting.postMessage).not.toHaveBeenCalled();
    controllerChange();
    expect(reload).not.toHaveBeenCalled();

    controller.applyUpdate();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    controllerChange();
    controllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
