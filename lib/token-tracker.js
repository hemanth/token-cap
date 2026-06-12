import crypto from 'node:crypto';

/**
 * Tracks token usage across an autonomous agent session.
 * Records per-turn breakdowns, accumulates session totals,
 * and estimates cost based on configurable rates.
 */
export class TokenTracker {
  /** @type {{ inputRate: number, outputRate: number, reasoningRate: number }} */
  #rates;
  /** @type {Array<import('./types.js').TurnRecord>} */
  #history = [];
  /** @type {{ input: number, output: number, reasoning: number, total: number }} */
  #cumulative = { input: 0, output: 0, reasoning: 0, total: 0 };

  /**
   * @param {object} [opts]
   * @param {number} [opts.inputRate=0.01]    Cost per 1K input tokens
   * @param {number} [opts.outputRate=0.03]   Cost per 1K output tokens
   * @param {number} [opts.reasoningRate=0.05] Cost per 1K reasoning tokens
   */
  constructor(opts = {}) {
    this.#rates = {
      inputRate: opts.inputRate ?? 0.01,
      outputRate: opts.outputRate ?? 0.03,
      reasoningRate: opts.reasoningRate ?? 0.05,
    };
  }

  /**
   * Record a single turn's token usage.
   * @param {{ input: number, output: number, reasoning?: number, tool?: string, toolArgs?: string }} usage
   * @returns {import('./types.js').TurnRecord}
   */
  recordTurn(usage) {
    const reasoning = usage.reasoning ?? 0;
    const total = usage.input + usage.output + reasoning;
    const record = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      input: usage.input,
      output: usage.output,
      reasoning,
      total,
      tool: usage.tool,
      toolArgs: usage.toolArgs,
    };
    this.#history.push(record);
    this.#cumulative.input += usage.input;
    this.#cumulative.output += usage.output;
    this.#cumulative.reasoning += reasoning;
    this.#cumulative.total += total;
    return record;
  }

  /** @returns {{ input: number, output: number, reasoning: number, total: number }} */
  getCumulativeUsage() {
    return { ...this.#cumulative };
  }

  /**
   * Estimate session cost in USD based on configured rates.
   * @returns {{ input: number, output: number, reasoning: number, total: number }}
   */
  getCostEstimate() {
    const c = this.#cumulative;
    const input = (c.input / 1000) * this.#rates.inputRate;
    const output = (c.output / 1000) * this.#rates.outputRate;
    const reasoning = (c.reasoning / 1000) * this.#rates.reasoningRate;
    return { input, output, reasoning, total: input + output + reasoning };
  }

  /** @returns {ReadonlyArray<import('./types.js').TurnRecord>} */
  getHistory() {
    return [...this.#history];
  }

  /** @returns {number} */
  get turnCount() {
    return this.#history.length;
  }
}
