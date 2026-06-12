import { TokenTracker } from './token-tracker.js';
import { BudgetMonitor } from './budget-monitor.js';
import { KillSwitch } from './kill-switch.js';
import { AnomalyDetector } from './anomaly-detector.js';

/**
 * Creates a unified monitor that wires together tracking, budgets, and kill-switches.
 *
 * @param {object} config
 * @param {number} [config.maxTokens=1_000_000] - Token ceiling
 * @param {number} [config.maxCost=10.0] - Cost ceiling in USD
 * @param {number} [config.maxDuplicateCalls=3] - Identical tool calls before kill
 * @param {number} [config.reasoningPctThreshold=80] - Reasoning % to flag
 * @param {number} [config.inputRate=0.01] - $/1K input tokens
 * @param {number} [config.outputRate=0.03] - $/1K output tokens
 * @param {number} [config.reasoningRate=0.05] - $/1K reasoning tokens
 * @returns {Monitor}
 *
 * @example
 * import { tokenBudget, fromOpenAI } from 'token-budget';
 *
 * const m = monitor({ maxTokens: 500_000, maxCost: 5.00 });
 *
 * const response = await openai.chat.completions.create({ ... });
 * m.record(fromOpenAI(response));
 *
 * if (!m.ok) console.log(m.reason);
 */
export function tokenBudget(config = {}) {
  const {
    maxTokens = 1_000_000,
    maxCost = 10.0,
    maxDuplicateCalls = 3,
    reasoningPctThreshold = 80,
    inputRate,
    outputRate,
    reasoningRate,
  } = config;

  const tracker = new TokenTracker({ inputRate, outputRate, reasoningRate });
  const budget = new BudgetMonitor({ maxTokens, maxCost });
  const killSwitch = new KillSwitch({ maxCost, maxDuplicateCalls, reasoningPctThreshold });
  const detector = new AnomalyDetector();

  let _ok = true;
  let _reason = null;
  const _listeners = { warning: [], tripped: [] };

  budget.on('warning', (e) => _listeners.warning.forEach(fn => fn(e)));
  budget.on('critical', (e) => _listeners.warning.forEach(fn => fn(e)));
  killSwitch.on('tripped', (e) => _listeners.tripped.forEach(fn => fn(e)));

  return {
    /**
     * Record a turn. Pass output from a provider adapter or raw { input, output, reasoning }.
     * @param {object} usage - { input, output, reasoning, tool?, toolArgs? }
     */
    record(usage) {
      const record = tracker.recordTurn(usage);
      const cumulative = tracker.getCumulativeUsage();
      const cost = tracker.getCostEstimate();

      const { allowed } = budget.checkBudget(cumulative, cost);
      const { safe, violations } = killSwitch.evaluate(record, cost);

      if (!allowed || !safe) {
        _ok = false;
        _reason = violations?.[0] ?? `Budget exceeded: ${cumulative.total.toLocaleString()} tokens, $${cost.total.toFixed(2)}`;
      }

      return this;
    },

    /** true if the agent should continue */
    get ok() { return _ok; },

    /** reason the monitor stopped the agent, or null */
    get reason() { return _reason; },

    /** cumulative token usage */
    get usage() { return tracker.getCumulativeUsage(); },

    /** estimated cost breakdown */
    get cost() { return tracker.getCostEstimate(); },

    /** number of turns recorded */
    get turns() { return tracker.turnCount; },

    /** full turn history */
    get history() { return tracker.getHistory(); },

    /** run anomaly detection on history */
    analyze() { return detector.analyze(tracker.getHistory()); },

    /** subscribe to warnings */
    on(event, fn) {
      if (_listeners[event]) _listeners[event].push(fn);
      return this;
    },
  };
}
