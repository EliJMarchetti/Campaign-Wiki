import { describe, expect, it } from "vitest";
import { parseImportText } from "../src/lib/importers";

describe("transcript import parsers", () => {
  it("preserves SRT timestamps, speakers and stable anchors", () => {
    const parsed = parseImportText(
      [
        "1",
        "00:00:01,000 --> 00:00:03,500",
        "GM: The gate opens.",
        "",
        "2",
        "00:00:04,000 --> 00:00:05,000",
        "Rowan: I think it is a trap."
      ].join("\n"),
      "session.srt"
    );
    expect(parsed.utterances).toHaveLength(2);
    expect(parsed.utterances[0]).toMatchObject({
      stableAnchor: "u0001",
      speakerLabel: "GM",
      startMs: 1000,
      endMs: 3500,
      text: "The gate opens."
    });
  });

  it("reads common JSON transcript segments", () => {
    const parsed = parseImportText(
      JSON.stringify({ segments: [{ id: "seg-a", speaker: "GM", start: 1.2, end: 3.4, text: "GM RULING: The bridge stands." }] }),
      "transcript.json"
    );
    expect(parsed.utterances[0]?.utteranceId).toBe("seg-a");
    expect(parsed.utterances[0]?.startMs).toBe(1200);
    expect(parsed.normalizedText).toContain("GM RULING");
  });

  it("creates paragraph anchors for untimestamped text", () => {
    const parsed = parseImportText("First paragraph.\n\nSecond paragraph.", "notes.md");
    expect(parsed.blocks.map((block) => block.stableAnchor)).toEqual(["p0001", "p0002"]);
    expect(parsed.utterances).toHaveLength(0);
  });
});
