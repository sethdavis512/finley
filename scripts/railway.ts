#!/usr/bin/env bun
import { $ } from "bun";
import { existsSync } from "fs";
import { createInterface } from "readline";

const COMMANDS = {
  setup:  "Login + initialize Railway project + sync env vars",
  deploy: "Build & deploy to Railway via Dockerfile",
  db:     "Provision a Postgres database (sets DATABASE_URL automatically)",
  domain: "Generate a railway.app domain for this service",
  vars:   "Re-sync .env variables to Railway (skips NODE_ENV)",
  logs:   "Stream deployment logs",
  status: "Show current Railway project status",
  open:   "Open Railway dashboard in browser",
} as const;

type Command = keyof typeof COMMANDS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function checkRailway() {
  try {
    await $`railway --version`.quiet();
  } catch {
    console.error("Railway CLI not found. Install it: brew install railway");
    process.exit(1);
  }
}

async function checkLogin() {
  try {
    const { stdout } = await $`railway whoami`.quiet();
    console.log(`Logged in as: ${stdout.toString().trim()}`);
  } catch {
    console.log("Not logged in to Railway. Starting login...");
    await $`railway login`;
  }
}

async function isLinked(): Promise<boolean> {
  try {
    await $`railway status`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function hasService(): Promise<boolean> {
  try {
    const { stdout } = await $`railway status`.quiet();
    return !stdout.toString().includes("Service: None");
  } catch {
    return false;
  }
}

async function requireLinked() {
  if (!(await isLinked())) {
    console.error("No Railway project linked. Run setup first:");
    console.error("  bun scripts/railway.ts setup");
    process.exit(1);
  }
}

async function syncVars() {
  if (!existsSync(".env")) {
    console.log("No .env file found — skipping variable sync.");
    return;
  }

  const envText = await Bun.file(".env").text();
  const vars: string[] = [];

  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Skip NODE_ENV — Railway sets production automatically
    if (trimmed.startsWith("NODE_ENV=")) continue;
    vars.push(trimmed);
  }

  if (vars.length === 0) {
    console.log("No variables to sync.");
    return;
  }

  const flags = vars.flatMap((v) => ["--set", v]);
  console.log(`Syncing ${vars.length} variable(s) to Railway...`);
  await $`railway variables ${flags}`;
  console.log("Variables synced.");
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function setup() {
  await checkRailway();
  await checkLogin();

  if (await isLinked()) {
    console.log("Already linked to a Railway project.");
    const { stdout } = await $`railway status`.quiet();
    console.log(stdout.toString().trim());
  } else {
    console.log("No Railway project linked. Initializing...");
    await $`railway init`;
  }

  if (!(await hasService())) {
    console.log("No service found. Creating service 'finley'...");
    await $`railway add --service finley`;
  }

  await syncVars();

  console.log("\nSetup complete. Next steps:");
  console.log("  bun scripts/railway.ts db");
  console.log("  bun scripts/railway.ts deploy");
  console.log("  bun scripts/railway.ts domain");
}

async function deploy() {
  await checkRailway();
  await checkLogin();
  await requireLinked();

  console.log("Deploying to Railway...");
  await $`railway up --detach`;
  console.log("\nDeployment triggered. Stream logs with:");
  console.log("  bun scripts/railway.ts logs");
}

async function db() {
  await checkRailway();
  await checkLogin();
  await requireLinked();

  // Check if DATABASE_URL is already wired to this service
  const { stdout: varOut } = await $`railway variables --json`.quiet();
  const vars = JSON.parse(varOut.toString() || "{}");
  if (vars.DATABASE_URL) {
    console.log("DATABASE_URL is already set — Postgres already wired.");
    return;
  }

  // Check if a Postgres service already exists in the project
  const ref = "${{Postgres.DATABASE_URL}}";
  const postgresExists = await $`railway variables --service Postgres --json`
    .quiet()
    .then(() => true)
    .catch(() => false);

  if (postgresExists) {
    const useExisting = await askYesNo(
      "A Postgres service already exists in this project. Use it?"
    );
    if (useExisting) {
      await $`railway variables --set ${`DATABASE_URL=${ref}`}`;
      console.log("DATABASE_URL wired to existing Postgres service.");
      return;
    }
    const addAnother = await askYesNo("Add another Postgres instance?");
    if (!addAnother) {
      console.log("Skipping Postgres setup.");
      return;
    }
  }

  console.log("Provisioning Postgres database...");
  await $`railway add --database postgres`;

  // Wire DATABASE_URL from the Postgres service into the app service.
  // Railway doesn't do this automatically — it must be set as a reference variable.
  await $`railway variables --set ${`DATABASE_URL=${ref}`}`;
  console.log("Postgres provisioned and DATABASE_URL wired to this service.");
}

async function domain() {
  await checkRailway();
  await checkLogin();
  await requireLinked();

  console.log("Generating Railway domain...");
  await $`railway domain --port 3141`;
}

async function logs() {
  await checkRailway();
  await $`railway logs --tail`;
}

async function status() {
  await checkRailway();
  await $`railway status`;
}

async function open() {
  await checkRailway();
  await $`railway open`;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function printHelp() {
  console.log("Usage: bun scripts/railway.ts <command>\n");
  console.log("Commands:");
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(10)} ${desc}`);
  }
  console.log("\nFirst-time setup order:");
  console.log("  setup -> db -> deploy -> domain");
}

const command = process.argv[2] as Command | undefined;

switch (command) {
  case "setup":  await setup();  break;
  case "deploy": await deploy(); break;
  case "db":     await db();     break;
  case "domain": await domain(); break;
  case "vars":
    await checkRailway();
    await checkLogin();
    await syncVars();
    break;
  case "logs":   await logs();   break;
  case "status": await status(); break;
  case "open":   await open();   break;
  default:
    printHelp();
    if (command) {
      console.error(`\nUnknown command: ${command}`);
      process.exit(1);
    }
}
