# token-budgets

Framework-agnostic token budget monitoring and kill-switches for autonomous AI agents.

Works with any LLM provider — Gemini, Claude, GPT, Ollama, or custom models. Zero dependencies.

## Quick Start

```bash
node demo.js
# or
npm run demo
```

No dependencies to install — pure Node.js ES modules.

## Usage With Any Provider

```js
import { TokenTracker } from './lib/token-tracker.js';
import { BudgetMonitor } from './lib/budget-monitor.js';
import { KillSwitch } from './lib/kill-switch.js';

// Configure rates for your provider
const tracker = new TokenTracker({
  inputRate: 0.01,      // $/1K input tokens
  outputRate: 0.03,     // $/1K output tokens
  reasoningRate: 0.05   // $/1K reasoning tokens
});

const budget = new BudgetMonitor({ maxTokens: 500_000, maxCost: 10.00 });
const killSwitch = new KillSwitch({ maxCost: 10.00 });

// After each agent turn, record the usage from your provider
const record = tracker.recordTurn({
  input: response.usage.prompt_tokens,       // OpenAI
  output: response.usage.completion_tokens,  // OpenAI
  reasoning: response.usage.reasoning_tokens || 0,
  tool: 'read_file',
  toolArgs: '/src/config.ts'
});

// Check budget + kill-switch
const { allowed } = budget.checkBudget(tracker.getCumulativeUsage(), tracker.getCostEstimate());
const { safe, violations } = killSwitch.evaluate(record, tracker.getCostEstimate());

if (!safe) console.error('Kill-switch tripped:', violations);
if (!allowed) console.error('Budget exhausted');
```

### Provider Rate Examples

| Provider | Input ($/1K) | Output ($/1K) | Reasoning ($/1K) |
|----------|-------------|---------------|-------------------|
| Gemini 2.5 Pro | 0.00125 | 0.01 | 0.0125 |
| Claude Sonnet 4 | 0.003 | 0.015 | 0.015 |
| GPT-4o | 0.0025 | 0.01 | 0.01 |
| Ollama (local) | 0 | 0 | 0 |

## Demo

The demo simulates a 20-turn autonomous agent session across three phases:

| Phase | Turns | Behavior |
|-------|-------|----------|
| 🟢 Healthy | 1–10 | Varied tools, moderate token counts |
| 🟡 Degrading | 11–15 | Rising tokens, repeated file reads |
| 🔴 Rogue | 16–20 | Same tool/args loop, reasoning bloat |

The budget monitor fires warnings at **50%** and **75%**, and the kill-switch trips when the cost ceiling is breached.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Your Agent Loop                 │
│         (any framework, any model)           │
│                                              │
│  ┌──────────────┐   ┌───────────────────┐   │
│  │ TokenTracker  │──▶│  BudgetMonitor    │   │
│  │ per-turn logs │   │  ceiling enforce  │   │
│  └──────────────┘   └───────────────────┘   │
│         │                     │              │
│         ▼                     ▼              │
│  ┌──────────────┐   ┌───────────────────┐   │
│  │ KillSwitch   │   │ AnomalyDetector   │   │
│  │ circuit break │   │ sliding window    │   │
│  └──────────────┘   └───────────────────┘   │
└─────────────────────────────────────────────┘
```

### Modules

| Module | Purpose |
|--------|---------|
| `lib/token-tracker.js` | Records per-turn `{ input, output, reasoning }`, accumulates totals, estimates cost at configurable rates |
| `lib/budget-monitor.js` | Enforces max-token and max-cost ceilings. Fires `warning`, `critical`, `killed` events |
| `lib/kill-switch.js` | Four circuit-breaker rules: velocity, degenerate loops, cost ceiling, reasoning bloat |
| `lib/anomaly-detector.js` | Sliding-window detection: repeated reads, circular tool calls, reasoning repetition |

### Kill-Switch Rules

| Rule | Trigger |
|------|---------|
| Velocity | `> N` tokens/turn for `M` consecutive turns |
| Degenerate Loop | Same tool + args called `K` times consecutively |
| Cost Ceiling | Cumulative cost exceeds `$X` |
| Reasoning Bloat | Reasoning tokens `> Y%` of total for `Z` consecutive turns |

## API

All constructors accept configuration objects with sensible defaults. All monitors emit events via Node.js `EventEmitter`.

```js
// Events
budget.on('warning', ({ percent, message }) => { });
budget.on('critical', ({ percent, message }) => { });
budget.on('killed', ({ reason }) => { });
killSwitch.on('tripped', ({ violations }) => { });
```

## License

MIT
