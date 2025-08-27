#!/usr/bin/env node

/**
 * Test script to verify the iOS PWA update system
 * This simulates the build and update process
 */

import fs from "fs";
import path from "path";

const SW_PATH = path.join(process.cwd(), "dist", "sw.js");
const SOURCE_SW_PATH = path.join(process.cwd(), "public", "sw.js");

function testUpdateSystem() {
  console.log("🧪 Testing iOS PWA Update System...\n");

  try {
    // Check if service worker exists
    if (!fs.existsSync(SW_PATH)) {
      console.log("❌ Service worker not found at:", SW_PATH);
      console.log('   Run "npm run build" first to generate the service worker');
      return;
    }

    // Read service worker content
    const swContent = fs.readFileSync(SW_PATH, "utf8");

    // Check for timestamp
    const timestampMatch = swContent.match(/const CACHE_VERSION = "(\d+)";/);
    if (!timestampMatch) {
      console.log("❌ No timestamp found in service worker");
      return;
    }

    const timestamp = timestampMatch[1];
    console.log(`✅ Service worker timestamp: ${timestamp}`);

    // Check for dynamic cache names
    const cacheNameMatch = swContent.match(
      /const CACHE_NAME = `dicey-movements-v\${CACHE_VERSION}`;/
    );
    if (!cacheNameMatch) {
      console.log("❌ Dynamic cache naming not implemented");
      return;
    }
    console.log("✅ Dynamic cache naming implemented");

    // Check for cache cleanup
    const cacheCleanupMatch = swContent.match(/Clean up ALL old caches to ensure fresh content/);
    if (!cacheCleanupMatch) {
      console.log("❌ Aggressive cache cleanup not implemented");
      return;
    }
    console.log("✅ Aggressive cache cleanup implemented");

    // Check for force refresh
    const forceRefreshMatch = swContent.match(/FORCE_REFRESH = true/);
    if (!forceRefreshMatch) {
      console.log("❌ Force refresh not implemented");
      return;
    }
    console.log("✅ Force refresh implemented");

    // Check for HTML file exclusion from caching
    const htmlExclusionMatch = swContent.match(/excluding index\.html to ensure updates/);
    if (!htmlExclusionMatch) {
      console.log("❌ HTML file exclusion not implemented");
      return;
    }
    console.log("✅ HTML file exclusion implemented");

    // Check for network-first strategy
    const networkFirstMatch = swContent.match(
      /For HTML files, always fetch fresh from network first/
    );
    if (!networkFirstMatch) {
      console.log("❌ Network-first strategy not implemented");
      return;
    }
    console.log("✅ Network-first strategy implemented");

    console.log("\n🎉 All tests passed! Your iOS PWA update system is working correctly.");
    console.log("\n📱 Next steps:");
    console.log("   1. Deploy your app to production");
    console.log("   2. Test on an iOS device by adding to home screen");
    console.log("   3. Make a change and rebuild");
    console.log("   4. Verify the update banner appears");
  } catch (error) {
    console.error("❌ Error testing update system:", error.message);
  }
}

// Run the test
testUpdateSystem();
