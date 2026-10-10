import { inflateRawSync } from "node:zlib";
import type { NormalizedBlock, TranscriptUtterance } from "./types";
import { newId } from "./id";

export interface ParsedImport {
  normalizedText: string;
  blocks: Omit<NormalizedBlock, "id" | "sourceId" | "sourceVersionId">[];
  utterances: Omit<TranscriptUtterance, "id" | "sourceId" | "sourceVersionId">[];
  warnings: string[];
}

export async function extractTextFromUpload(fileName: string, mimeType: string, buffer: Buffer): Promise<{
  text: string;
  warnings: string[];
}> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    try {
      return { text: extractDocxText(buffer), warnings: [] };
    } catch (error) {
      return { text: "", warnings: [`DOCX text extraction failed: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }
  if (lower.endsWith(".pdf") || mimeType.includes("pdf")) {
    try {
      const text = extractPdfText(buffer);
      const warnings = text.trim() ? [] : ["No extractable text was found. Scanned PDF OCR is future work."];
      return { text, warnings };
    } catch (error) {
      return { text: "", warnings: [`PDF text extraction failed: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }
  return { text: buffer.toString("utf8"), warnings: [] };
}

export function parseImportText(text: string, fileName = "pasted.txt"): ParsedImport {
  const trimmed = text.trim();
  if (!trimmed) {
    return { normalizedText: "", blocks: [], utterances: [], warnings: ["Source text is empty."] };
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".srt")) return parseSrt(trimmed);
  if (lower.endsWith(".vtt")) return parseVtt(trimmed);
  if (lower.endsWith(".json") || looksLikeJson(trimmed)) {
    const parsed = parseJsonTranscript(trimmed);
    if (parsed) return parsed;
  }
  return parseParagraphText(trimmed);
}

function looksLikeJson(text: string): boolean {
  return (text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"));
}

function parseParagraphText(text: string): ParsedImport {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const blocks = paragraphs.map((paragraph, index) => ({
    stableAnchor: `p${String(index + 1).padStart(4, "0")}`,
    ordinal: index + 1,
    blockType: paragraph.startsWith("#") ? ("heading" as const) : ("paragraph" as const),
    text: paragraph
  }));
  return { normalizedText: paragraphs.join("\n\n"), blocks, utterances: [], warnings: [] };
}

function parseSrt(text: string): ParsedImport {
  const entries = text.split(/\n\s*\n/);
  const utterances: ParsedImport["utterances"] = [];
  const warnings: string[] = [];
  entries.forEach((entry, index) => {
    const lines = entry.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) return;
    const timingLine = lines.find((line) => line.includes("-->"));
    if (!timingLine) {
      warnings.push(`SRT block ${index + 1} is missing a timestamp.`);
      return;
    }
    const textLines = lines.slice(lines.indexOf(timingLine) + 1);
    const [startRaw, endRaw] = timingLine.split("-->").map((part) => part.trim());
    const parsedText = textLines.join(" ");
    const { speaker, text: utteranceText } = splitSpeaker(parsedText);
    utterances.push({
      stableAnchor: `u${String(utterances.length + 1).padStart(4, "0")}`,
      utteranceId: String(index + 1),
      speakerLabel: speaker,
      startMs: parseTimestamp(startRaw),
      endMs: parseTimestamp(endRaw),
      text: utteranceText
    });
  });
  return fromUtterances(utterances, warnings);
}

function parseVtt(text: string): ParsedImport {
  const body = text.replace(/^WEBVTT[^\n]*\n+/i, "");
  const entries = body.split(/\n\s*\n/);
  const utterances: ParsedImport["utterances"] = [];
  for (const entry of entries) {
    const lines = entry.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const timingLine = lines.find((line) => line.includes("-->"));
    if (!timingLine) continue;
    const [startRaw, endRaw] = timingLine.split("-->").map((part) => part.trim().split(/\s+/)[0]);
    const textLines = lines.slice(lines.indexOf(timingLine) + 1);
    const parsedText = textLines.join(" ");
    const { speaker, text: utteranceText } = splitSpeaker(parsedText);
    utterances.push({
      stableAnchor: `u${String(utterances.length + 1).padStart(4, "0")}`,
      utteranceId: String(utterances.length + 1),
      speakerLabel: speaker,
      startMs: parseTimestamp(startRaw),
      endMs: parseTimestamp(endRaw),
      text: utteranceText
    });
  }
  return fromUtterances(utterances, []);
}

function parseJsonTranscript(text: string): ParsedImport | undefined {
  try {
    const data = JSON.parse(text) as unknown;
    const segments = Array.isArray(data)
      ? data
      : isRecord(data) && Array.isArray(data.segments)
        ? data.segments
        : isRecord(data) && Array.isArray(data.utterances)
          ? data.utterances
          : undefined;
    if (!segments) return undefined;
    const utterances: ParsedImport["utterances"] = [];
    segments.forEach((segment, index) => {
        if (!isRecord(segment)) return undefined;
        const rawText = String(segment.text ?? segment.transcript ?? "").trim();
        if (!rawText) return undefined;
        utterances.push({
          stableAnchor: `u${String(index + 1).padStart(4, "0")}`,
          utteranceId: String(segment.id ?? index + 1),
          speakerLabel: segment.speaker ? String(segment.speaker) : segment.speaker_label ? String(segment.speaker_label) : undefined,
          startMs: toMs(segment.start ?? segment.start_ms),
          endMs: toMs(segment.end ?? segment.end_ms),
          text: rawText
        });
      });
    return fromUtterances(utterances, []);
  } catch {
    return undefined;
  }
}

function fromUtterances(utterances: ParsedImport["utterances"], warnings: string[]): ParsedImport {
  const blocks = utterances.map((utterance, index) => ({
    stableAnchor: utterance.stableAnchor,
    ordinal: index + 1,
    blockType: "utterance" as const,
    speakerLabel: utterance.speakerLabel,
    startMs: utterance.startMs,
    endMs: utterance.endMs,
    text: utterance.text
  }));
  const normalizedText = utterances
    .map((utterance) => `${formatMs(utterance.startMs)} ${utterance.speakerLabel ? `${utterance.speakerLabel}: ` : ""}${utterance.text}`)
    .join("\n");
  return { normalizedText, blocks, utterances, warnings };
}

function splitSpeaker(text: string): { speaker?: string; text: string } {
  const match = text.match(/^([A-Za-z][A-Za-z0-9 _.-]{0,40}):\s+(.+)$/);
  if (!match) return { text };
  return { speaker: match[1], text: match[2] };
}

function parseTimestamp(value: string): number | undefined {
  const cleaned = value.replace(",", ".");
  const parts = cleaned.split(":").map(Number);
  if (parts.some(Number.isNaN)) return undefined;
  if (parts.length === 3) {
    return Math.round(((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000);
  }
  if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000);
  return undefined;
}

function toMs(value: unknown): number | undefined {
  if (typeof value === "number") return value < 10_000 ? Math.round(value * 1000) : Math.round(value);
  if (typeof value === "string") return parseTimestamp(value);
  return undefined;
}

function formatMs(value?: number): string {
  if (value === undefined) return "[no timestamp]";
  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `[${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}]`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractDocxText(buffer: Buffer): string {
  const entries = readZipEntries(buffer);
  const documentEntry = entries.find((entry) => entry.name === "word/document.xml");
  if (!documentEntry) throw new Error("word/document.xml was not found.");
  const xml = documentEntry.data.toString("utf8");
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const strings: string[] = [];
  const literalPattern = /\((?:\\.|[^\\)])*\)/g;
  for (const match of raw.matchAll(literalPattern)) {
    const value = match[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\([()\\])/g, "$1");
    if (/[A-Za-z]{2}/.test(value)) strings.push(value);
  }
  return strings.join(" ").replace(/\s+/g, " ").trim();
}

function readZipEntries(buffer: Buffer): Array<{ name: string; data: Buffer }> {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Invalid ZIP archive.");
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: Array<{ name: string; data: Buffer }> = [];
  let cursor = centralDirOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid ZIP central directory.");
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.slice(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : Buffer.alloc(0);
    entries.push({ name, data });
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

export function blockIdsForSource(sourceId: string, parsed: ParsedImport): {
  blocks: NormalizedBlock[];
  utterances: TranscriptUtterance[];
  sourceVersionId: string;
} {
  const sourceVersionId = newId();
  return {
    sourceVersionId,
    blocks: parsed.blocks.map((block) => ({
      ...block,
      id: newId(),
      sourceId,
      sourceVersionId
    })),
    utterances: parsed.utterances.map((utterance) => ({
      ...utterance,
      id: newId(),
      sourceId,
      sourceVersionId
    }))
  };
}
