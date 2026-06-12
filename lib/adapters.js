/**
 * Provider adapters — map any LLM response to { input, output, reasoning }.
 *
 * Usage:
 *   import { fromOpenAI } from 'token-budget/adapters';
 *   tracker.recordTurn(fromOpenAI(response));
 */

/**
 * OpenAI / OpenAI-compatible (Groq, Together, Fireworks, LM Studio, etc.)
 * @param {object} response - chat.completions.create() response
 */
export function fromOpenAI(response) {
  const u = response.usage ?? {};
  return {
    input: u.prompt_tokens ?? 0,
    output: u.completion_tokens ?? 0,
    reasoning: u.completion_tokens_details?.reasoning_tokens ?? 0,
  };
}

/**
 * Google Gemini (AI Studio / Vertex)
 * @param {object} response - generateContent() response
 */
export function fromGemini(response) {
  const u = response.response?.usageMetadata ?? response.usageMetadata ?? {};
  return {
    input: u.promptTokenCount ?? 0,
    output: u.candidatesTokenCount ?? 0,
    reasoning: u.thoughtsTokenCount ?? 0,
  };
}

/**
 * Anthropic Claude
 * @param {object} response - messages.create() response
 */
export function fromAnthropic(response) {
  const u = response.usage ?? {};
  return {
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    reasoning: 0,
  };
}

/**
 * Ollama (local models)
 * @param {object} response - ollama.chat() response
 */
export function fromOllama(response) {
  return {
    input: response.prompt_eval_count ?? 0,
    output: response.eval_count ?? 0,
    reasoning: 0,
  };
}

/**
 * Raw numbers — when you already have the counts.
 * @param {number} input
 * @param {number} output
 * @param {number} [reasoning=0]
 */
export function fromRaw(input, output, reasoning = 0) {
  return { input, output, reasoning };
}
