# token-budgets

Token budget monitoring and kill-switches for autonomous AI agents. Zero dependencies.

```bash
npm install token-budgets
```

## Quick start

```js
import { TokenTracker, BudgetMonitor, KillSwitch, fromOpenAI } from 'token-budgets';

const tracker = new TokenTracker();
const budget = new BudgetMonitor({ maxTokens: 500_000, maxCost: 5.00 });
const killSwitch = new KillSwitch({ maxCost: 5.00 });

// After each LLM call, feed the response through an adapter
const response = await openai.chat.completions.create({ model: 'gpt-4o', messages });
const record = tracker.recordTurn(fromOpenAI(response));

const { allowed } = budget.checkBudget(tracker.getCumulativeUsage(), tracker.getCostEstimate());
const { safe } = killSwitch.evaluate(record, tracker.getCostEstimate());

if (!allowed || !safe) agent.stop();
```

`fromOpenAI()` maps the response to `{ input, output, reasoning }`. `recordTurn()` logs it. `checkBudget()` enforces ceilings. `evaluate()` runs the circuit breaker.

## Adapters

One adapter per provider. Each returns `{ input, output, reasoning }`:

```js
import { fromOpenAI, fromGemini, fromAnthropic, fromOllama, fromRaw } from 'token-budgets';

tracker.recordTurn(fromOpenAI(response));     // OpenAI, Groq, Together, Fireworks, LM Studio
tracker.recordTurn(fromGemini(response));     // Google AI Studio, Vertex
tracker.recordTurn(fromAnthropic(response));  // Claude
tracker.recordTurn(fromOllama(response));     // Ollama, any local model
tracker.recordTurn(fromRaw(3200, 800, 5400)); // raw numbers
```

Works with any provider that returns token counts. If yours isn't listed, use `fromRaw()`.

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

## Budget ceilings

```js
const budget = new BudgetMonitor({
  maxTokens: 500_000,
  maxCost: 5.00,
  thresholds: [50, 75, 90],
});

budget.on('warning',  (e) => console.log(e.message));
budget.on('critical', (e) => console.log(e.message));
budget.on('killed',   (e) => stopAgent(e.reason));

const { allowed, remaining, percentUsed } = budget.checkBudget(usage, cost);
```

## Kill-switch

Four circuit-breaker rules:

```js
const ks = new KillSwitch({
  maxTokensPerTurn: 40_000,
  velocityWindow: 5,
  maxDuplicateCalls: 3,
  maxCost: 10.00,
  reasoningPctThreshold: 80,
  reasoningWindow: 3,
});

ks.on('tripped', ({ violations }) => console.error(violations));
const { safe, violations } = ks.evaluate(turnRecord, costEstimate);
```

- **Velocity** — massive context every turn, likely re-reading the codebase
- **Degenerate loop** — same tool + args called N times in a row
- **Cost ceiling** — hard dollar backstop
- **Reasoning runaway** — model thinking hard, producing nothing

## Anomaly detection

```js
import { AnomalyDetector } from 'token-budgets';

const detector = new AnomalyDetector({ windowSize: 5 });
const { anomalies, score, recommendation } = detector.analyze(tracker.getHistory());
```

`score` goes from 0 (healthy) to 1 (degenerate).

## Demo

```bash
npm run demo
```

Simulates 20 turns across healthy → degrading → rogue phases. Kill-switch trips when cost ceiling breaches.

## Related

- [Feature request on Antigravity SDK](https://github.com/google-antigravity/antigravity-sdk-python/issues/59)
- [Blog: Building Kill-Switches for Autonomous AI Agents](https://h3manth.com/scribe/zero-overhead-token-budgets/)

## License

MIT © [Hemanth.HM](https://h3manth.com)
