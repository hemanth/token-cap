/**
 * Sliding-window pattern detector for autonomous agent sessions.
 * Identifies repeated file reads, circular tool calls,
 * and reasoning-trace repetition via simple string similarity.
 */
export class AnomalyDetector {
  #windowSize;

  /** @param {{ windowSize?: number }} [opts] */
  constructor(opts = {}) {
    this.#windowSize = opts.windowSize ?? 5;
  }

  /**
   * Analyze recent history for anomalous patterns.
   * @param {Array<{ tool?: string, toolArgs?: string, reasoning?: number, total?: number }>} history
   * @returns {{ anomalies: string[], score: number, recommendation: string }}
   */
  analyze(history) {
    const window = history.slice(-this.#windowSize);
    const anomalies = [];
    let score = 0;

    // Repeated file reads
    const reads = window.filter(t => t.tool?.includes('read'));
    const readArgs = reads.map(t => t.toolArgs);
    const uniqueReads = new Set(readArgs);
    if (reads.length >= 3 && uniqueReads.size === 1) {
      anomalies.push(`Same file read ${reads.length}x in last ${this.#windowSize} turns`);
      score += 0.4;
    }

    // Circular tool calls (A→B→A→B pattern)
    const tools = window.map(t => t.tool).filter(Boolean);
    if (tools.length >= 4) {
      const pattern = tools.slice(0, 2).join(',');
      const repeated = tools.slice(2, 4).join(',');
      if (pattern === repeated) {
        anomalies.push(`Circular tool pattern detected: ${tools.slice(0, 2).join(' → ')}`);
        score += 0.3;
      }
    }

    // Reasoning repetition — check if reasoning % is consistently high
    const reasoningPcts = window
      .filter(t => t.total > 0)
      .map(t => ((t.reasoning ?? 0) / t.total) * 100);
    const avgReasoning = reasoningPcts.length
      ? reasoningPcts.reduce((a, b) => a + b, 0) / reasoningPcts.length
      : 0;
    if (avgReasoning > 60) {
      anomalies.push(`Reasoning averaging ${avgReasoning.toFixed(0)}% of tokens over window`);
      score += 0.3;
    }

    score = Math.min(score, 1.0);
    const recommendation =
      score >= 0.7 ? 'KILL — agent is in a degenerate loop'
      : score >= 0.4 ? 'WARN — patterns suggest degradation'
      : 'OK — behavior within normal parameters';

    return { anomalies, score, recommendation };
  }

  /**
   * Simple bigram similarity between two strings (0–1).
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  static similarity(a, b) {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const bigrams = (s) => {
      const set = new Map();
      for (let i = 0; i < s.length - 1; i++) {
        const bg = s.slice(i, i + 2);
        set.set(bg, (set.get(bg) ?? 0) + 1);
      }
      return set;
    };
    const aB = bigrams(a), bB = bigrams(b);
    let intersect = 0;
    for (const [bg, count] of aB) intersect += Math.min(count, bB.get(bg) ?? 0);
    return (2 * intersect) / (a.length + b.length - 2);
  }
}
