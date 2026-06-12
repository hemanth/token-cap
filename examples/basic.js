import { TokenTracker, BudgetMonitor } from '../index.js';

const tracker = new TokenTracker({
  inputRate: 0.00125,    // Gemini 2.5 Pro rates
  outputRate: 0.01,
  reasoningRate: 0.0125,
});

const budget = new BudgetMonitor({ maxTokens: 100_000, maxCost: 2.00 });

budget.on('warning', (e) => console.log(`⚠️  ${e.message}`));
budget.on('killed', () => console.log('🔴 Budget exhausted'));

// Simulate your agent loop
for (let i = 0; i < 10; i++) {
  // Replace with real usage from your LLM provider:
  //   response.usage.prompt_tokens, response.usage.completion_tokens, etc.
  const record = tracker.recordTurn({
    input: Math.round(2000 + Math.random() * 1000),
    output: Math.round(500 + Math.random() * 500),
    reasoning: Math.round(1000 + Math.random() * 2000),
  });

  const { allowed, percentUsed } = budget.checkBudget(
    tracker.getCumulativeUsage(),
    tracker.getCostEstimate()
  );

  console.log(`Turn ${i + 1}: ${record.total.toLocaleString()} tokens | ${percentUsed.toFixed(1)}% budget used`);

  if (!allowed) {
    console.log('Agent stopped — budget exceeded.');
    break;
  }
}

console.log(`\nTotal cost: $${tracker.getCostEstimate().total.toFixed(4)}`);
