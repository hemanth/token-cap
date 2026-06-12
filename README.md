# token-budgets

Framework-agnostic token budget monitoring and kill-switches for autonomous AI agents.

Works with any LLM provider — Gemini, Claude, GPT, Ollama, or custom models. Zero dependencies. Pure Node.js ES modules.

> Filed as a [feature request](https://github.com/google-antigravity/antigravity-sdk-python/issues/59) for the Antigravity SDK. This library extracts the patterns into a standalone, provider-agnostic package.

## Install

```bash
npm install token-budgets
```

Or just copy the `lib/` folder — zero dependencies, ~400 lines total.

## Quick Start

```js
import { TokenTracker, BudgetMonitor, KillSwitch } from 'token-budgets';

const tracker = new TokenTracker();
const budget = new BudgetMonitor({ maxTokens: 500_000, maxCost: 5.00 });
const killSwitch = new KillSwitch({ maxCost: 5.00 });

// Your agent loop — any provider, any framework
for await (const turn of agentLoop()) {
  // Feed in token counts from your provider's response
  const record = tracker.recordTurn({
    input: turn.usage.prompt_tokens,
    output: turn.usage.completion_tokens,
    reasoning: turn.usage.reasoning_tokens ?? 0,
    tool: turn.toolName,
    toolArgs: turn.toolArgs,
  });

  const usage = tracker.getCumulativeUsage();
  const cost = tracker.getCostEstimate();

  // Budget ceiling
  const { allowed } = budget.checkBudget(usage, cost);
  if (!allowed) break;

  // Kill-switch (circuit breaker)
  const { safe, violations } = killSwitch.evaluate(record, cost);
  if (!safe) { console.error('Kill-switch:', violations); break; }
}
```

## Modules

Four independent modules. Use one, use all.

### TokenTracker — the meter

Records per-turn usage, accumulates session totals, estimates cost.

```js
import { TokenTracker } from 'token-budgets';

const tracker = new TokenTracker({
  inputRate: 0.00125,     // $/1K input tokens (Gemini 2.5 Pro)
  outputRate: 0.01,       // $/1K output tokens
  reasoningRate: 0.0125,  // $/1K reasoning tokens
});

tracker.recordTurn({ input: 3200, output: 800, reasoning: 5400 });

tracker.getCumulativeUsage();  // { input, output, reasoning, total }
tracker.getCostEstimate();     // { input, output, reasoning, total } in USD
tracker.getHistory();          // full array of all turns with UUIDs + timestamps
tracker.turnCount;             // number of recorded turns
```

### BudgetMonitor — the ceiling

Enforces token and cost limits. Fires events at configurable thresholds.

```js
import { BudgetMonitor } from 'token-budgets';

const budget = new BudgetMonitor({
  maxTokens: 500_000,
  maxCost: 5.00,
  thresholds: [50, 75, 90],  // percentage alerts
});

budget.on('warning',  (e) => console.log(e.message));  // 50%, 75%
budget.on('critical', (e) => console.log(e.message));  // 90%
budget.on('killed',   (e) => stopAgent(e.reason));      // ceiling hit

const { allowed, remaining, percentUsed } = budget.checkBudget(usage, cost);
```

### KillSwitch — the circuit breaker

Four independent rules that detect degenerate agent behavior:

```js
import { KillSwitch } from 'token-budgets';

const ks = new KillSwitch({
  maxTokensPerTurn: 40_000,    // velocity ceiling per turn
  velocityWindow: 5,           // consecutive turns to trigger
  maxDuplicateCalls: 3,        // identical tool calls before kill
  maxCost: 10.00,              // dollar ceiling
  reasoningPctThreshold: 80,   // reasoning % to flag
  reasoningWindow: 3,          // consecutive high-reasoning turns
});

ks.on('tripped', ({ violations }) => violations.forEach(v => console.error(v)));

const { safe, violations } = ks.evaluate(turnRecord, costEstimate);
```

| Rule | What it catches |
|------|----------------|
| **Velocity** | Agent consuming massive context every turn — likely re-reading the codebase |
| **Degenerate loop** | Same tool + args called N times — the agent is stuck |
| **Cost ceiling** | Hard dollar backstop |
| **Reasoning runaway** | Model thinking hard, producing nothing — reasoning/output ratio > threshold |

### AnomalyDetector — the watcher

Sliding-window pattern analysis. Reports anomalies, doesn't kill.

```js
import { AnomalyDetector } from 'token-budgets';

const detector = new AnomalyDetector({ windowSize: 5 });

const { anomalies, score, recommendation } = detector.analyze(tracker.getHistory());
// anomalies: ["Same file read 4x in last 5 turns"]
// score: 0.7  (0 = healthy, 1 = degenerate)
// recommendation: "KILL — agent is in a degenerate loop"
```

## Provider Rates

Configure `TokenTracker` with your provider's pricing:

| Provider | `inputRate` | `outputRate` | `reasoningRate` |
|----------|------------|-------------|-----------------|
| Gemini 2.5 Pro | 0.00125 | 0.01 | 0.0125 |
| Claude Sonnet 4 | 0.003 | 0.015 | 0.015 |
| GPT-4o | 0.0025 | 0.01 | 0.01 |
| Ollama (local) | 0 | 0 | 0 |

Defaults: `inputRate=0.01`, `outputRate=0.03`, `reasoningRate=0.05`

## Demo

```bash
npm run demo
```

Simulates a 20-turn agent session across three phases:

| Phase | Turns | Behavior |
|-------|-------|----------|
| 🟢 Healthy | 1–10 | Varied tools, moderate tokens |
| 🟡 Degrading | 11–15 | Rising tokens, repeated reads |
| 🔴 Rogue | 16–20 | Same tool/args loop, reasoning bloat |

The kill-switch trips when the cost ceiling is breached — stopping the session before the rogue loop drains the budget.

## Architecture

```
Your Agent Loop (any provider, any framework)
    │
    │  after each turn, feed { input, output, reasoning }
    │
    ▼
┌──────────────┐     ┌────────────────┐
│ TokenTracker │────▶│ BudgetMonitor  │
│  the meter   │     │  the ceiling   │
└──────┬───────┘     └───────┬────────┘
       │                     │
       ▼                     ▼
┌──────────────┐     ┌────────────────┐
│  KillSwitch  │     │AnomalyDetector │
│  the breaker │     │  the watcher   │
└──────────────┘     └────────────────┘
```

## Related

- [Feature request on Antigravity SDK](https://github.com/google-antigravity/antigravity-sdk-python/issues/59) — proposing built-in budget enforcement hooks
- [Blog post: Building Kill-Switches for Autonomous AI Agents](https://h3manth.com/scribe/zero-overhead-token-budgets/) — deep dive using the Antigravity SDK

## License

MIT
