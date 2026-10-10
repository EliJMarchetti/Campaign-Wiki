import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyState } from "./state";
import type { WikiState } from "./types";

const defaultPath = path.join(process.cwd(), "data", "campaign-wiki.json");

export function dataPath(): string {
  const configured = process.env.CAMPAIGN_WIKI_DATA_PATH;
  if (!configured) return defaultPath;
  return path.isAbsolute(configured) ? configured : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

export async function loadState(): Promise<WikiState> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ dataPath(), "utf8");
    return { ...emptyState(), ...(JSON.parse(raw) as WikiState) };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return emptyState();
    throw error;
  }
}

export async function saveState(state: WikiState): Promise<void> {
  const file = dataPath();
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temp, file);
}

export async function updateState(mutator: (state: WikiState) => WikiState | Promise<WikiState>): Promise<WikiState> {
  const current = await loadState();
  const next = await mutator(current);
  await saveState(next);
  return next;
}
