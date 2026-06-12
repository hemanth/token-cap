import { EventEmitter } from 'node:events';

/**
 * Automated circuit breakers that evaluate each turn against
 * configurable safety rules. Emits `tripped` when a rule fires.
 */
export class KillSwitch extends EventEmitter {
  #rules;
  #velocityStreak = 0;
  #reasoningStreak = 0;
  #toolCallLog = [];

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxTokensPerTurn=8000]   Velocity ceiling
   * @param {number} [opts.velocityWindow=3]         Consecutive turns to trigger
   * @param {number} [opts.maxDuplicateCalls=3]      Identical tool calls before kill
   * @param {number} [opts.maxCost=1.00]             USD cost ceiling
   * @param {number} [opts.reasoningPctThreshold=70] Reasoning % of total to flag
   * @param {number} [opts.reasoningWindow=3]        Consecutive high-reasoning turns
   */
  constructor(opts = {}) {
    super();
    this.#rules = {
      maxTokensPerTurn: opts.maxTokensPerTurn ?? 8000,
      velocityWindow: opts.velocityWindow ?? 3,
      maxDuplicateCalls: opts.maxDuplicateCalls ?? 3,
      maxCost: opts.maxCost ?? 1.0,
      reasoningPctThreshold: opts.reasoningPctThreshold ?? 70,
      reasoningWindow: opts.reasoningWindow ?? 3,
    };
  }

  /**
   * Evaluate a turn against all circuit-breaker rules.
   * @param {{ total: number, reasoning: number, tool?: string, toolArgs?: string }} turn
   * @param {{ total: number }} cost  Current cumulative cost
   * @returns {{ safe: boolean, violations: string[] }}
   */
  evaluate(turn, cost) {
    const violations = [];

    // Rule 1: Token velocity
    if (turn.total > this.#rules.maxTokensPerTurn) {
      this.#velocityStreak++;
      if (this.#velocityStreak >= this.#rules.velocityWindow) {
        violations.push(`Token velocity exceeded ${this.#rules.maxTokensPerTurn}/turn for ${this.#velocityStreak} consecutive turns`);
      }
    } else {
      this.#velocityStreak = 0;
    }

    // Rule 2: Degenerate loop — identical tool + args
    if (turn.tool) {
      const sig = `${turn.tool}::${turn.toolArgs ?? ''}`;
      this.#toolCallLog.push(sig);
      const tail = this.#toolCallLog.slice(-this.#rules.maxDuplicateCalls);
      if (tail.length === this.#rules.maxDuplicateCalls && tail.every(s => s === sig)) {
        violations.push(`Degenerate loop: ${turn.tool} called ${this.#rules.maxDuplicateCalls}x with identical args`);
      }
    }

    // Rule 3: Cost ceiling
    if (cost.total > this.#rules.maxCost) {
      violations.push(`Cumulative cost $${cost.total.toFixed(4)} exceeds $${this.#rules.maxCost.toFixed(2)} ceiling`);
    }

    // Rule 4: Reasoning bloat
    const reasoningPct = turn.total > 0 ? (turn.reasoning / turn.total) * 100 : 0;
    if (reasoningPct > this.#rules.reasoningPctThreshold) {
      this.#reasoningStreak++;
      if (this.#reasoningStreak >= this.#rules.reasoningWindow) {
        violations.push(`Reasoning tokens at ${reasoningPct.toFixed(0)}% for ${this.#reasoningStreak} consecutive turns`);
      }
    } else {
      this.#reasoningStreak = 0;
    }

    if (violations.length > 0) {
      this.emit('tripped', { violations, turn });
    }

    return { safe: violations.length === 0, violations };
  }
}
