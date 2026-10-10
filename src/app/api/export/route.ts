import { NextRequest } from "next/server";
import { exportBackup } from "@/lib/workflows";
import { loadState } from "@/lib/store";
import type { Viewer } from "@/lib/types";

export async function GET(request: NextRequest) {
  const state = await loadState();
  const campaignId = request.nextUrl.searchParams.get("campaignId");
  if (!campaignId) return Response.json({ error: "campaignId is required" }, { status: 400 });
  const viewer: Viewer = {
    profileId: request.nextUrl.searchParams.get("userId") || undefined,
    campaignId,
    mode: (request.nextUrl.searchParams.get("mode") as Viewer["mode"]) || "public"
  };
  const backup = exportBackup(state, viewer, campaignId);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="campaign-wiki-${campaignId}.json"`
    }
  });
}
