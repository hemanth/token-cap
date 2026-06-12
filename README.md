# token-budgets

Token budget monitoring and kill-switches for autonomous AI agents. Zero dependencies.

```bash
npm install token-budgets
```

## Quick start

```js
import { TokenTracker, BudgetMonitor, KillSwitch } from 'token-budgets';

const tracker = new TokenTracker();
const budget = new BudgetMonitor({ maxTokens: 500_000, maxCost: 5.00 });
const killSwitch = new KillSwitch({ maxCost: 5.00 });

// Your agent loop — any provider, any framework
for await (const turn of agentLoop()) {
  const record = tracker.recordTurn({
    input: turn.usage.prompt_tokens,
    output: turn.usage.completion_tokens,
    reasoning: turn.usage.reasoning_tokens ?? 0,
    tool: turn.toolName,
    toolArgs: turn.toolArgs,
  });

  const { allowed } = budget.checkBudget(
    tracker.getCumulativeUsage(),
    tracker.getCostEstimate()
  );
  if (!allowed) break;

  const { safe } = killSwitch.evaluate(record, tracker.getCostEstimate());
  if (!safe) break;
}
```

`recordTurn()` logs usage. `checkBudget()` enforces ceilings. `evaluate()` runs the circuit breaker. That's the whole API.

## Token tracking

```js
const tracker = new TokenTracker({
  inputRate: 0.00125,     // $/1K tokens — configure for your provider
  outputRate: 0.01,
  reasoningRate: 0.0125,
});

tracker.recordTurn({ input: 3200, output: 800, reasoning: 5400 });

tracker.getCumulativeUsage();  // { input, output, reasoning, total }
tracker.getCostEstimate();     // { input, output, reasoning, total } in USD
tracker.getHistory();          // every turn with UUID + timestamp
```

Works with any LLM. Feed it `{ input, output, reasoning }` from OpenAI, Gemini, Claude, Ollama — it doesn't care.

## Budget ceilings

```js
const budget = new BudgetMonitor({
  maxTokens: 500_000,
  maxCost: 5.00,
  thresholds: [50, 75, 90],
});

budget.on('warning',  (e) => console.log(e.message));   // 50%
budget.on('critical', (e) => console.log(e.message));   // 75%, 90%
budget.on('killed',   (e) => stopAgent(e.reason));       // ceiling hit

const { allowed, remaining, percentUsed } = budget.checkBudget(usage, cost);
```

## Kill-switch

Four circuit-breaker rules:

```js
const ks = new KillSwitch({
  maxTokensPerTurn: 40_000,    // velocity: N tokens/turn for M consecutive turns
  velocityWindow: 5,
  maxDuplicateCalls: 3,        // loop: same tool+args called K times
  maxCost: 10.00,              // cost: hard dollar ceiling
  reasoningPctThreshold: 80,   // reasoning: thinking > X% of total for Y turns
  reasoningWindow: 3,
});

ks.on('tripped', ({ violations }) => console.error(violations));

const { safe, violations } = ks.evaluate(turnRecord, costEstimate);
```

- **Velocity** — agent consuming massive context every turn, likely re-reading the codebase
- **Degenerate loop** — same tool + args called N times in a row
- **Cost ceiling** — hard dollar backstop
- **Reasoning runaway** — model thinking hard, producing nothing

## Anomaly detection

Sliding-window pattern analysis. Reports anomalies, doesn't kill:

```js
import { AnomalyDetector } from 'token-budgets';

const detector = new AnomalyDetector({ windowSize: 5 });
const { anomalies, score, recommendation } = detector.analyze(tracker.getHistory());
// score: 0 = healthy, 1 = degenerate
```

## Demo

```bash
npm run demo
```

Simulates 20 turns across healthy → degrading → rogue phases. Kill-switch trips when the cost ceiling breaches.

## Related

- [Feature request on Antigravity SDK](https://github.com/google-antigravity/antigravity-sdk-python/issues/59)
- [Blog: Building Kill-Switches for Autonomous AI Agents](https://h3manth.com/scribe/zero-overhead-token-budgets/)

## License

MIT © [Hemanth.HM](https://h3manth.com)
