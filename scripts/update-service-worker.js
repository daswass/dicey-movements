#!/usr/bin/env node

/**
 * Post-build script to update service worker timestamp for better cache busting
 * This ensures iOS PWAs get fresh content after each deployment
 */

import fs from "fs";
import path from "path";

const SW_PATH = path.join(process.cwd(), "dist", "sw.js");

function updateServiceWorker() {
  try {
    // Check if service worker exists
    if (!fs.existsSync(SW_PATH)) {
      console.log("Service worker not found at:", SW_PATH);
      return;
    }

    // Read current service worker
    let swContent = fs.readFileSync(SW_PATH, "utf8");

    // Generate new timestamp
    const newTimestamp = Date.now().toString();

    // Update the timestamp in the service worker
    const updatedContent = swContent.replace(
      /const CACHE_VERSION = Date\.now\(\)\.toString\(\);/,
      `const CACHE_VERSION = "${newTimestamp}";`
    );

    // Write updated service worker
    fs.writeFileSync(SW_PATH, updatedContent, "utf8");

    console.log(`✅ Service worker updated with timestamp: ${newTimestamp}`);
    console.log(`📱 iOS PWA cache will be invalidated on next visit`);
  } catch (error) {
    console.error("❌ Error updating service worker:", error.message);
    process.exit(1);
  }
}

// Run the update
updateServiceWorker();
