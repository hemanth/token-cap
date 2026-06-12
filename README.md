# token-limiter

Token budget monitoring and kill-switches for autonomous AI agents. Zero dependencies.

```bash
npm install token-limiter
```

## Quick start

```js
import { tokenLimiter, fromOpenAI } from 'token-limiter';

const budget = tokenLimiter({ maxTokens: 500_000, maxCost: 5.00 });

const response = await openai.chat.completions.create({ model: 'gpt-4o', messages });
budget.record(fromOpenAI(response));

if (!budget.ok) console.log(budget.reason);
```

`fromOpenAI()` maps the response to `{ input, output, reasoning }`. `record()` tracks it, checks the ceiling, runs the circuit breaker. `ok` tells you if the agent should continue.

## Adapters

One adapter per provider. Each returns `{ input, output, reasoning }`:

```js
import { fromOpenAI, fromGemini, fromAnthropic, fromOllama, fromRaw } from 'token-limiter';

budget.record(fromOpenAI(response));     // OpenAI, Groq, Together, Fireworks, LM Studio
budget.record(fromGemini(response));     // Google AI Studio, Vertex
budget.record(fromAnthropic(response));  // Claude
budget.record(fromOllama(response));     // Ollama, any local model
budget.record(fromRaw(3200, 800, 5400)); // raw numbers
```

Works with any provider that returns token counts. If yours isn't listed, use `fromRaw()`.

## What `tokenLimiter()` gives you

```js
budget.ok        // should the agent continue?
budget.reason    // why it stopped, or null
budget.usage     // { input, output, reasoning, total }
budget.cost      // { input, output, reasoning, total } in USD
budget.turns     // number of turns recorded
budget.history   // full turn history
budget.analyze() // run anomaly detection
```

## Config

```js
const budget = tokenLimiter({
  maxTokens: 500_000,          // token ceiling
  maxCost: 5.00,               // dollar ceiling
  maxDuplicateCalls: 3,        // identical tool calls before kill
  reasoningPctThreshold: 80,   // reasoning % to flag
  inputRate: 0.00125,          // $/1K input tokens
  outputRate: 0.01,            // $/1K output tokens
  reasoningRate: 0.0125,       // $/1K reasoning tokens
});
```

## Events

```js
budget.on('warning', (e) => console.log(e.message));   // 50%, 75%, 90% thresholds
budget.on('tripped', (e) => console.error(e.violations)); // circuit breaker fired
```

## Individual modules

If you need more control, the internals are exported too:

```js
import { TokenTracker, BudgetMonitor, KillSwitch, AnomalyDetector } from 'token-limiter';
```

## Demo

```bash
npm run demo
```

Simulates 20 turns across healthy → degrading → rogue phases. Kill-switch trips when cost ceiling breaches.

## Related

- [Feature request on Antigravity SDK](https://github.com/google-antigravity/antigravity-sdk-python/issues/59)
- [Blog: Building Kill-Switches for Autonomous AI Agents](https://h3manth.com/scribe/zero-overhead-token-limiter/)

## License

MIT © [Hemanth.HM](https://h3manth.com)
