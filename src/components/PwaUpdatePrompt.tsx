import { useEffect, useRef, useState } from "react";
import { registerPwaUpdates, type PwaUpdateController } from "../utils/pwaUpdate";

export function PwaUpdatePrompt() {
  const [updateController, setUpdateController] = useState<PwaUpdateController | null>(null);
  const controllerRef = useRef<PwaUpdateController | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const controller = registerPwaUpdates({
      serviceWorker: navigator.serviceWorker,
      onUpdateAvailable: () => setUpdateController(controller),
      reload: () => window.location.reload(),
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  if (!updateController) return null;

  return (
    <aside
      role="status"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-md rounded-lg bg-slate-900 p-4 text-white shadow-2xl ring-1 ring-white/15">
      <p className="font-semibold">Update ready</p>
      <p className="mt-1 text-sm text-slate-200">
        Your current workout stays in place. Apply when you are ready to refresh.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setUpdateController(null)}
          className="rounded px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10">
          Later
        </button>
        <button
          type="button"
          onClick={() => {
            controllerRef.current?.applyUpdate();
            setUpdateController(null);
          }}
          className="rounded bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-400">
          Apply update
        </button>
      </div>
    </aside>
  );
}
