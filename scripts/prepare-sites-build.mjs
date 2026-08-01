#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");
const serverFiles = [
  "http.js",
  "api-router.js",
  "news.js",
  "news-feeds.js",
  "map.js",
  "route.js",
  "realtime.js",
];

for (const file of [
  index,
  worker,
  hosting,
  ...serverFiles.map((name) => path.join(root, "server", name)),
]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
copyFileSync(worker, path.join(dist, "server", "index.js"));
for (const name of serverFiles) {
  copyFileSync(
    path.join(root, "server", name),
    path.join(dist, "server", name),
  );
}
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));

console.log("Prepared Sites build: Worker, API modules, and hosting manifest");
