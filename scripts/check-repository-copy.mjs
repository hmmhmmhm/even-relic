import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HANGUL_PATTERN = /[가-힣]/u;
const LEGACY_BRAND_PATTERN =
  /\beven-relic\b|com\.hmmhmmhm\.evenrelic|\bRELIC\b|\bRelic\b|\brelic(?=[:A-Z])/u;
const LEGACY_EVIDENCE_PATTERN = /\blegacy evidence\b/iu;

function linesOf(content) {
  return content.split(/\r?\n/u);
}

export function findHangulViolations(entries) {
  const violations = [];

  for (const entry of entries) {
    linesOf(entry.content).forEach((line, index) => {
      if (HANGUL_PATTERN.test(line)) {
        violations.push({
          path: entry.path,
          line: index + 1,
          message: "Hangul is not allowed in tracked Markdown",
          excerpt: line.trim(),
        });
      }
    });
  }

  return violations;
}

export function findCurrentBrandViolations(entries) {
  const violations = [];

  for (const entry of entries) {
    linesOf(entry.content).forEach((line, index) => {
      if (
        LEGACY_BRAND_PATTERN.test(line)
        && !LEGACY_EVIDENCE_PATTERN.test(line)
      ) {
        violations.push({
          path: entry.path,
          line: index + 1,
          message: "Active legacy project branding is not allowed",
          excerpt: line.trim(),
        });
      }
    });
  }

  return violations;
}

export function validateRepositoryMetadata({ packageManifest, appManifest }) {
  const violations = [];

  if (packageManifest.name !== "sandevistan") {
    violations.push({
      path: "package.json",
      line: 1,
      field: "package.name",
      message: 'Package name must be "sandevistan"',
    });
  }

  if (packageManifest.private !== true) {
    violations.push({
      path: "package.json",
      line: 1,
      field: "package.private",
      message: "The npm package must remain private",
    });
  }

  if (appManifest.package_id !== "com.hmmhmmhm.sandevistan") {
    violations.push({
      path: "app.json",
      line: 1,
      field: "app.package_id",
      message: 'App package_id must be "com.hmmhmmhm.sandevistan"',
    });
  }

  if (appManifest.name !== "SANDEVISTAN") {
    violations.push({
      path: "app.json",
      line: 1,
      field: "app.name",
      message: 'App name must be "SANDEVISTAN"',
    });
  }

  return violations;
}

function trackedFiles(repositoryRoot, pathspecs) {
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--", ...pathspecs],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  return output.split("\0").filter(Boolean);
}

function readEntries(repositoryRoot, paths) {
  return paths.map((filePath) => ({
    path: filePath,
    content: readFileSync(path.join(repositoryRoot, filePath), "utf8"),
  }));
}

function formatViolation(violation) {
  const location = `${violation.path}:${violation.line}`;
  const suffix = violation.excerpt ? ` — ${violation.excerpt}` : "";
  return `${location} ${violation.message}${suffix}`;
}

export function checkRepository(repositoryRoot = process.cwd()) {
  const markdownPaths = trackedFiles(repositoryRoot, ["*.md", "**/*.md"]);
  const currentSourcePaths = trackedFiles(repositoryRoot, [
    "package.json",
    "package-lock.json",
    "app.json",
    "index.html",
    "src/**",
  ]);
  const packageManifest = JSON.parse(
    readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  const appManifest = JSON.parse(
    readFileSync(path.join(repositoryRoot, "app.json"), "utf8"),
  );

  return [
    ...findHangulViolations(readEntries(repositoryRoot, markdownPaths)),
    ...findCurrentBrandViolations(
      readEntries(repositoryRoot, currentSourcePaths),
    ),
    ...validateRepositoryMetadata({ packageManifest, appManifest }),
  ];
}

function runCli() {
  const violations = checkRepository();

  if (violations.length > 0) {
    console.error(
      `Repository copy check failed with ${violations.length} violation(s):`,
    );
    for (const violation of violations) {
      console.error(formatViolation(violation));
    }
    process.exitCode = 1;
    return;
  }

  console.log("Repository copy check passed.");
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (currentFile === invokedFile) {
  runCli();
}
