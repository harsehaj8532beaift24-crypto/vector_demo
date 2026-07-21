import Anthropic from "@anthropic-ai/sdk";
import type { JsonSchemaFormat } from "./schemas";

/**
 * The seam between the Planning Service and the model. Everything above this
 * interface is pure logic that can be tested with a fake; everything below is
 * the real network call. The Anthropic key never leaves this module.
 */

export interface CompletionRequest {
  system: string;
  user: string;
  /** Structured-outputs schema the model is constrained to emit. */
  format: JsonSchemaFormat;
}

export interface LlmClient {
  /** Returns the raw JSON string the model produced (schema-constrained). */
  complete(req: CompletionRequest): Promise<string>;
}

/** Default model per the Anthropic guidance; override with ANTHROPIC_MODEL. */
const DEFAULT_MODEL = "claude-opus-4-8";

export class AnthropicClient implements LlmClient {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(opts?: { apiKey?: string; model?: string }) {
    const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    this.client = new Anthropic({ apiKey });
    this.model = opts?.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  }

  async complete(req: CompletionRequest): Promise<string> {
    // Stream + finalMessage() so the large, thinking-heavy response never trips
    // the SDK HTTP timeout. Adaptive thinking + high effort: this is reasoning,
    // not chat. Structured outputs constrains the response to `format`.
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          name: req.format.name,
          schema: req.format.schema,
        },
      },
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    } as Anthropic.MessageStreamParams);

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new Error("Model refused the planning request");
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    if (!text.trim()) {
      throw new Error("Model returned an empty response");
    }
    return text;
  }
}

let singleton: LlmClient | null = null;

/** Lazily constructs the real client. Server-only. Tests inject a fake instead. */
export function getLlmClient(): LlmClient {
  if (!singleton) singleton = new AnthropicClient();
  return singleton;
}
