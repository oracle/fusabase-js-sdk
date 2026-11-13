import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suites = {
  "collection-level": {
    label: "Collection-level test suite",
    logFile: "collection-level-test-suite.log",
    envFile: "collection.env",
    tests: [
      "test/test_auth.test.js",
      "test/test_oracledb.test.js",
      "test/test_storage.test.js",
    ],
  },
  relational: {
    label: "Relational test suite",
    logFile: "relational-test-suite.log",
    envFile: "relational.env",
    tests: [
      "test/test_relational_projection.integration.test.js",
      "test/test_relational_behavior.integration.test.js",
      "test/test_relational_ords.integration.test.js",
    ],
  },
  "relational-behavior": {
    label: "Relational behavior integration test suite",
    logFile: "relational-behavior-integration-test-suite.log",
    envFile: "relational.env",
    tests: ["test/test_relational_behavior.integration.test.js"],
  },
};

const suiteName = process.argv[2];
const suite = suites[suiteName];
if (!suite) {
  console.error(
    `Usage: node scripts/run-test-suite.js <${Object.keys(suites).join("|")}>`,
  );
  process.exitCode = 2;
} else {
  const logsDir = path.join(repoRoot, "test", "logs");
  mkdirSync(logsDir, { recursive: true });

  const logPath = path.join(logsDir, suite.logFile);
  const log = createWriteStream(logPath, { flags: "w" });
  log.write(
    `${suite.label}\nStarted: ${new Date().toISOString()}\nTests:\n${suite.tests
      .map((testFile) => `  ${testFile}`)
      .join("\n")}\n\n`,
  );

  const mochaPath = path.join(repoRoot, "node_modules", "mocha", "bin", "mocha.js");
  const requestLoggerPath = path.join(repoRoot, "test", "request-logger.cjs");
  const envFilePath = path.join(repoRoot, suite.envFile);
  const child = spawn(
    process.execPath,
    [
      `--env-file=${envFilePath}`,
      mochaPath,
      "--require",
      requestLoggerPath,
      ...suite.tests,
    ],
    { cwd: repoRoot, stdio: ["inherit", "pipe", "pipe"] },
  );

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    log.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    log.write(chunk);
  });
  child.on("error", (error) => {
    const message = `Could not start ${suite.label}: ${error.message}\n`;
    process.stderr.write(message);
    log.write(message);
  });
  child.on("close", (code, signal) => {
    log.write(
      `\nFinished: ${new Date().toISOString()}\nExit: ${
        code ?? `terminated by ${signal}`
      }\n`,
    );
    log.end(() => {
      process.exitCode = code ?? 1;
    });
    console.log(`\n${suite.label} output saved to ${path.relative(repoRoot, logPath)}`);
  });
}
