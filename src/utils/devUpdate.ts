/**
 * Development utility for testing iOS PWA updates
 * This helps developers test the update system without rebuilding
 */

class DevUpdateHelper {
  private static instance: DevUpdateHelper;
  private updateCount = 0;

  private constructor() {
    // Only enable in development
    if (import.meta.env.DEV) {
      this.setupDevTools();
    }
  }

  public static getInstance(): DevUpdateHelper {
    if (!DevUpdateHelper.instance) {
      DevUpdateHelper.instance = new DevUpdateHelper();
    }
    return DevUpdateHelper.instance;
  }

  private setupDevTools(): void {
    // Add dev tools to window for easy testing
    (window as any).devUpdate = {
      forceUpdate: () => this.forceUpdate(),
      simulateUpdate: () => this.simulateUpdate(),
      clearCaches: () => this.clearCaches(),
      getUpdateCount: () => this.updateCount,
    };

    console.log("🔧 Dev Update Helper loaded!");
    console.log("   Use window.devUpdate.forceUpdate() to test updates");
    console.log("   Use window.devUpdate.simulateUpdate() to simulate new version");
    console.log("   Use window.devUpdate.clearCaches() to clear all caches");
  }

  public forceUpdate(): void {
    console.log("🔄 Forcing update...");

    // Clear all caches
    this.clearCaches();

    // Reload the page
    window.location.reload();
  }

  public simulateUpdate(): void {
    console.log("🎭 Simulating new version...");

    // Increment update count
    this.updateCount++;

    // Store in localStorage to simulate version change
    localStorage.setItem("devUpdateCount", this.updateCount.toString());

    // Show update banner
    this.showUpdateBanner();
  }

  public clearCaches(): void {
    console.log("🗑️ Clearing all caches...");

    if ("caches" in window) {
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              console.log("Deleting cache:", cacheName);
              return caches.delete(cacheName);
            })
          );
        })
        .then(() => {
          console.log("✅ All caches cleared");
        })
        .catch((error) => {
          console.error("❌ Error clearing caches:", error);
        });
    }

    // Clear localStorage
    localStorage.clear();
    console.log("✅ localStorage cleared");
  }

  private showUpdateBanner(): void {
    // Create update banner
    const updateBanner = document.createElement("div");
    updateBanner.id = "dev-update-banner";
    updateBanner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #10b981;
      color: white;
      padding: 12px;
      text-align: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    updateBanner.innerHTML = `
      <span>🧪 Dev Update Simulated (v${this.updateCount})</span>
      <button id="dev-update-btn" style="
        margin-left: 12px;
        background: white;
        color: #10b981;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
      ">Apply Update</button>
      <button id="dev-dismiss-btn" style="
        margin-left: 8px;
        background: transparent;
        color: white;
        border: 1px solid white;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
      ">Dismiss</button>
    `;

    // Remove existing banner if present
    const existingBanner = document.getElementById("dev-update-banner");
    if (existingBanner) {
      existingBanner.remove();
    }

    document.body.appendChild(updateBanner);

    // Handle update button
    document.getElementById("dev-update-btn")?.addEventListener("click", () => {
      this.forceUpdate();
    });

    // Handle dismiss button
    document.getElementById("dev-dismiss-btn")?.addEventListener("click", () => {
      updateBanner.remove();
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (document.body.contains(updateBanner)) {
        updateBanner.remove();
      }
    }, 10000);
  }
}

// Export singleton instance
export const devUpdateHelper = DevUpdateHelper.getInstance();
export default DevUpdateHelper;
