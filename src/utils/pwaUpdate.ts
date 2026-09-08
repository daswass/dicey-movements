export interface ServiceWorkerContainerLike {
  controller: ServiceWorker | null;
  register: (scriptURL: string, options?: RegistrationOptions) => Promise<ServiceWorkerRegistration>;
  addEventListener: (type: "controllerchange", listener: () => void) => void;
  removeEventListener: (type: "controllerchange", listener: () => void) => void;
}

export interface PwaUpdateController {
  applyUpdate: () => void;
  dispose: () => void;
}

/**
 * Installs updates only after the user explicitly accepts them. A waiting worker never interrupts
 * a workout, and the reload after activation is limited to that accepted update.
 */
export function registerPwaUpdates({
  serviceWorker,
  onUpdateAvailable,
  reload,
}: {
  serviceWorker: ServiceWorkerContainerLike;
  onUpdateAvailable: (registration: ServiceWorkerRegistration) => void;
  reload: () => void;
}): PwaUpdateController {
  let registration: ServiceWorkerRegistration | null = null;
  let applyingUpdate = false;
  let reloaded = false;

  const notifyIfWaiting = () => {
    if (registration?.waiting) onUpdateAvailable(registration);
  };

  const onControllerChange = () => {
    if (applyingUpdate && !reloaded) {
      reloaded = true;
      reload();
    }
  };

  serviceWorker.addEventListener("controllerchange", onControllerChange);

  void serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((nextRegistration) => {
      registration = nextRegistration;
      notifyIfWaiting();
      nextRegistration.addEventListener("updatefound", () => {
        const worker = nextRegistration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && serviceWorker.controller) notifyIfWaiting();
        });
      });
      return nextRegistration.update();
    })
    .catch((error) => console.error("Service Worker registration failed:", error));

  return {
    applyUpdate: () => {
      if (!registration?.waiting) return;
      applyingUpdate = true;
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    },
    dispose: () => serviceWorker.removeEventListener("controllerchange", onControllerChange),
  };
}
