import type { LlmClient, CompletionRequest } from "./client";

/**
 * Scripted LLM client for tests. Returns queued responses in order so a test
 * can simulate the model producing invalid output first and valid output on
 * retry. Records every request for assertions.
 */
export class FakeLlmClient implements LlmClient {
  readonly requests: CompletionRequest[] = [];
  private readonly responses: string[];

  constructor(responses: string[]) {
    this.responses = [...responses];
  }

  complete(req: CompletionRequest): Promise<string> {
    this.requests.push(req);
    const next = this.responses.shift();
    if (next === undefined) {
      throw new Error("FakeLlmClient ran out of scripted responses");
    }
    return Promise.resolve(next);
  }
}
