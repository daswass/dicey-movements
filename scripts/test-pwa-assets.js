#!/usr/bin/env node

import fs from "fs";
import path from "path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const requireFile = (relativePath) => {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Missing required PWA asset: ${relativePath}`);
  }
};

const manifest = JSON.parse(read("public/manifest.json"));
if (!manifest.name || !manifest.short_name || !manifest.start_url || !manifest.display) {
  throw new Error("PWA manifest is missing required app metadata");
}

for (const icon of manifest.icons || []) {
  requireFile(`public${icon.src}`);
}

const index = read("index.html");
for (const asset of ["/manifest.json", "/favicon.svg"]) {
  if (!index.includes(asset)) throw new Error(`index.html does not reference ${asset}`);
}
if (index.includes("window.location.reload()")) {
  throw new Error("index.html must not force-reload installed PWAs");
}

const worker = read("public/sw.js");
if (worker.includes("cache.addAll(")) {
  throw new Error("service-worker precache must not fail atomically through cache.addAll");
}

console.log("PWA asset contract passed");
