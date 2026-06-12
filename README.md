# token-budgets

Zero-overhead token budget monitoring for autonomous AI agents.

## Quick Start

```bash
node demo.js
# or
npm run demo
```

No dependencies to install — pure Node.js ES modules.

## What It Demonstrates

The demo simulates a 20-turn autonomous agent session across three phases:

| Phase | Turns | Behavior |
|-------|-------|----------|
| 🟢 Healthy | 1–10 | Varied tools, moderate token counts |
| 🟡 Degrading | 11–15 | Rising tokens, repeated file reads |
| 🔴 Rogue | 16–20 | Same tool/args loop, reasoning bloat |

The budget monitor fires warnings at **50%** and **75%**, and the kill-switch trips at **turn 17** when multiple circuit-breaker rules fire simultaneously.

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Agent Loop                  │
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

- **`lib/token-tracker.js`** — Records per-turn usage `{ input, output, reasoning }`, accumulates session totals, estimates cost with configurable rates.
- **`lib/budget-monitor.js`** — Enforces max-token and max-cost ceilings. Fires `warning`, `critical`, and `killed` events at configurable thresholds.
- **`lib/kill-switch.js`** — Four circuit-breaker rules: token velocity, degenerate loop detection, cost ceiling, reasoning bloat. Emits `tripped` events.
- **`lib/anomaly-detector.js`** — Sliding-window analysis detecting repeated reads, circular tool calls, and reasoning repetition with bigram similarity scoring.

### Kill-Switch Rules

| Rule | Trigger |
|------|---------|
| Velocity | `> N` tokens/turn for `M` consecutive turns |
| Degenerate Loop | Same tool + args called `K` times consecutively |
| Cost Ceiling | Cumulative cost exceeds `$X` |
| Reasoning Bloat | Reasoning tokens `> Y%` of total for `Z` consecutive turns |

## License

MIT
