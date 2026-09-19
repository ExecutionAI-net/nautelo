#!/usr/bin/env node
// Kills whatever is actually LISTENING on a TCP port and verifies the port
// is free afterward. Exists because `pnpm start`/`next start` on Windows
// spawns a pnpm.exe -> cmd.exe -> node.exe chain: stopping the shell that
// launched `pnpm start` only kills the top of that chain, leaving the real
// node.exe (the one holding the port) running as an orphan. Killing the
// actual port owner directly is the one thing that reliably works on every
// platform, so that is what this script does instead of trying to reach
// the right process through its ancestors.
import { execFileSync } from "node:child_process";

const port = process.argv[2];
if (!port || !/^\d+$/.test(port)) {
  console.error("Usage: node scripts/stop-port.mjs <port>");
  process.exit(2);
}

function findPidsWindows(port) {
  let out;
  try {
    out = execFileSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
  } catch {
    return [];
  }
  const pids = new Set();
  for (const line of out.split("\n")) {
    const cols = line.trim().split(/\s+/);
    // TCP  local-addr  remote-addr  STATE  PID
    if (cols.length < 5) continue;
    const [proto, local, , state, pid] = cols;
    if (proto !== "TCP") continue;
    if (state !== "LISTENING") continue;
    if (!local.endsWith(`:${port}`)) continue;
    if (pid && pid !== "0") pids.add(pid);
  }
  return [...pids];
}

function findPidsPosix(port) {
  try {
    const out = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
    });
    return out.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function killWindows(pid) {
  try {
    execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
  } catch {
    // already gone
  }
}

function killPosix(pid) {
  try {
    process.kill(Number(pid), "SIGKILL");
  } catch {
    // already gone
  }
}

const isWindows = process.platform === "win32";
const findPids = isWindows ? findPidsWindows : findPidsPosix;
const kill = isWindows ? killWindows : killPosix;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const attempts = 5;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const pids = findPids(port);
    if (pids.length === 0) {
      console.log(`Port ${port} is free.`);
      return;
    }
    console.log(`Attempt ${attempt}: killing PID(s) on port ${port}: ${pids.join(", ")}`);
    for (const pid of pids) kill(pid);
    await sleep(500);
  }

  const remaining = findPids(port);
  if (remaining.length > 0) {
    console.error(
      `Port ${port} still has listener PID(s) ${remaining.join(", ")} after ${attempts} attempts.`
    );
    process.exit(1);
  }
  console.log(`Port ${port} is free.`);
}

main();
