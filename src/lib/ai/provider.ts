import type { AiImportPayload } from "../schema";
import type { AiPromptPacket } from "../types";

export interface AiProvider {
  name: "mock" | "openai";
  runPacket(packet: AiPromptPacket): Promise<AiImportPayload>;
}

export class OpenAiProvider implements AiProvider {
  name = "openai" as const;

  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    private readonly model = process.env.OPENAI_MODEL ?? "gpt-5.1"
  ) {}

  async runPacket(packet: AiPromptPacket): Promise<AiImportPayload> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured. Export a prompt packet or use the mock provider.");
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: "system",
            content: packet.payload.instructions
          },
          {
            role: "user",
            content: JSON.stringify(packet.payload)
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "campaign_wiki_proposals",
            schema: packet.payload.schema,
            strict: true
          }
        }
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
    }
    const json = (await response.json()) as { output_text?: string };
    if (!json.output_text) throw new Error("OpenAI response did not contain output_text.");
    return JSON.parse(json.output_text) as AiImportPayload;
  }
}
