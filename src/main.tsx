import ReactDOM from "react-dom/client";
import App from "./App";
import { TimerWorkerProvider } from "./contexts/TimerWorkerContext";
import "./index.css"; // Your global styles

// Service worker registration with update handling
if ("serviceWorker" in navigator) {
  // Register service worker with proper scope
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      console.log("Service Worker registered:", registration);

      // Handle service worker updates
      registration.addEventListener("updatefound", () => {
        console.log("Service Worker update found");
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("New service worker installed, refreshing to activate");
              window.location.reload();
            }
          });
        }
      });
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
}

// Render the app immediately - let service worker handle its own lifecycle
ReactDOM.createRoot(document.getElementById("root")!).render(
  <TimerWorkerProvider>
    <App />
  </TimerWorkerProvider>
);
