import ReactDOM from "react-dom/client";
import App from "./App";
import { TimerWorkerProvider } from "./contexts/TimerWorkerContext";
import "./index.css"; // Your global styles

// Import dev update helper in development
if (import.meta.env.DEV) {
  import("./utils/devUpdate");
}

// Service worker registration with better update handling for iOS PWAs
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
              console.log("New service worker installed, prompting user for update");

              // Show update notification to user
              showUpdateNotification(registration);
            }
          });
        }
      });

      // Handle service worker controller change
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("Service Worker controller changed - new version activated");

        // Reload the page to ensure fresh content
        window.location.reload();
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "FORCE_REFRESH") {
          console.log("Service Worker requested force refresh for version:", event.data.version);
          // Force reload to ensure fresh content
          window.location.reload();
        }
      });

      // Check for updates on page load
      registration.update();
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
}

// Function to show update notification
function showUpdateNotification(registration: ServiceWorkerRegistration) {
  // Create a simple update banner
  const updateBanner = document.createElement("div");
  updateBanner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #007bff;
    color: white;
    padding: 12px;
    text-align: center;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
  `;

  updateBanner.innerHTML = `
    <span>🔄 New version available!</span>
    <button id="update-btn" style="
      margin-left: 12px;
      background: white;
      color: #007bff;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    ">Update Now</button>
    <button id="dismiss-btn" style="
      margin-left: 8px;
      background: transparent;
      color: white;
      border: 1px solid white;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
    ">Dismiss</button>
  `;

  document.body.appendChild(updateBanner);

  // Handle update button click
  document.getElementById("update-btn")?.addEventListener("click", () => {
    // Post message to service worker to skip waiting
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    updateBanner.remove();
  });

  // Handle dismiss button click
  document.getElementById("dismiss-btn")?.addEventListener("click", () => {
    updateBanner.remove();
  });

  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    if (document.body.contains(updateBanner)) {
      updateBanner.remove();
    }
  }, 30000);
}

// Render the app immediately - let service worker handle its own lifecycle
ReactDOM.createRoot(document.getElementById("root")!).render(
  <TimerWorkerProvider>
    <App />
  </TimerWorkerProvider>
);
