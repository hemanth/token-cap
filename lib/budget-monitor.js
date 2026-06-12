import { EventEmitter } from 'node:events';

/**
 * Enforces token and cost budget ceilings with threshold alerts.
 * Wraps async agent functions to auto-kill on budget exhaustion.
 */
export class BudgetMonitor extends EventEmitter {
  #maxTokens;
  #maxCost;
  #thresholds;
  #firedThresholds = new Set();

  /**
   * @param {object} opts
   * @param {number} opts.maxTokens            Maximum token budget
   * @param {number} [opts.maxCost=2.00]       Maximum cost in USD
   * @param {number[]} [opts.thresholds]       Alert thresholds as percentages
   */
  constructor({ maxTokens, maxCost = 2.0, thresholds = [50, 75, 90] }) {
    super();
    this.#maxTokens = maxTokens;
    this.#maxCost = maxCost;
    this.#thresholds = thresholds.sort((a, b) => a - b);
  }

  /**
   * Check current budget status against ceilings.
   * @param {{ total: number }} usage    Cumulative token usage
   * @param {{ total: number }} cost     Cumulative cost estimate
   * @returns {{ allowed: boolean, remaining: number, percentUsed: number, alerts: string[] }}
   */
  checkBudget(usage, cost) {
    const percentUsed = (usage.total / this.#maxTokens) * 100;
    const remaining = this.#maxTokens - usage.total;
    const alerts = [];

    for (const t of this.#thresholds) {
      if (percentUsed >= t && !this.#firedThresholds.has(t)) {
        this.#firedThresholds.add(t);
        const level = t >= 90 ? 'critical' : 'warning';
        const msg = `Budget ${t}% — ${usage.total.toLocaleString()} / ${this.#maxTokens.toLocaleString()} tokens`;
        alerts.push(msg);
        this.emit(level, { percent: t, usage, cost, message: msg });
      }
    }

    const allowed = usage.total < this.#maxTokens && cost.total < this.#maxCost;
    if (!allowed) {
      this.emit('killed', { reason: 'Budget exhausted', usage, cost });
    }

    return { allowed, remaining, percentUsed: Math.min(percentUsed, 100), alerts };
  }

  /**
   * Wrap an async function with budget enforcement.
   * @param {() => Promise<any>} callback
   * @param {{ total: number }} usage
   * @param {{ total: number }} cost
   * @returns {Promise<any>}
   */
  async enforce(callback, usage, cost) {
    const { allowed } = this.checkBudget(usage, cost);
    if (!allowed) throw new Error('Budget exceeded — execution killed');
    return callback();
  }
}
