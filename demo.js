import { TokenTracker } from './lib/token-tracker.js';
import { BudgetMonitor } from './lib/budget-monitor.js';
import { KillSwitch } from './lib/kill-switch.js';
import { AnomalyDetector } from './lib/anomaly-detector.js';

// ── ANSI helpers ─────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
  bgRed: '\x1b[41m', bgGreen: '\x1b[42m', bgYellow: '\x1b[43m',
  white: '\x1b[37m',
};

function bar(pct, width = 30) {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = pct >= 90 ? c.red : pct >= 75 ? c.yellow : c.green;
  return `${color}${'█'.repeat(filled)}${c.dim}${'░'.repeat(empty)}${c.reset} ${pct.toFixed(1)}%`;
}

function log(color, label, msg) {
  console.log(`  ${color}${c.bold}[${label}]${c.reset} ${msg}`);
}

// ── Simulation data ──────────────────────────────────────────
const TOOLS = ['read_file', 'write_file', 'grep_search', 'run_command', 'view_file'];

function simulateTurn(i) {
  if (i < 10) {
    // Healthy: varied tools, moderate tokens
    return {
      input: 400 + Math.floor(Math.random() * 300),
      output: 200 + Math.floor(Math.random() * 200),
      reasoning: 100 + Math.floor(Math.random() * 150),
      tool: TOOLS[i % TOOLS.length],
      toolArgs: `/src/module-${i}.ts`,
    };
  } else if (i < 15) {
    // Degradation: rising tokens, different files each time
    const bloat = (i - 9) * 600;
    return {
      input: 800 + bloat,
      output: 400 + bloat / 2,
      reasoning: 600 + bloat,
      tool: 'read_file',
      toolArgs: `/src/module-${i}.ts`,
    };
  } else {
    // Rogue loop: same tool, same args, reasoning bloat
    return {
      input: 3000,
      output: 1000,
      reasoning: 6000,
      tool: 'read_file',
      toolArgs: '/src/config.ts',
    };
  }
}

// ── Main ─────────────────────────────────────────────────────
const MAX_TOKENS = 60_000;

const tracker = new TokenTracker();
const budget = new BudgetMonitor({ maxTokens: MAX_TOKENS, maxCost: 1.0 });
const killSwitch = new KillSwitch({
  maxTokensPerTurn: 8000,
  velocityWindow: 2,
  maxDuplicateCalls: 3,
  maxCost: 1.0,
  reasoningPctThreshold: 60,
  reasoningWindow: 2,
});
const detector = new AnomalyDetector({ windowSize: 5 });

// Wire events
budget.on('warning', ({ message }) => log(c.yellow, 'WARN', message));
budget.on('critical', ({ message }) => log(c.red, 'CRIT', message));
budget.on('killed', ({ reason }) => log(c.bgRed + c.white, 'KILL', reason));
killSwitch.on('tripped', ({ violations }) =>
  violations.forEach(v => log(c.bgRed + c.white, 'TRIP', v))
);

console.log(`\n${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════╗${c.reset}`);
console.log(`${c.cyan}${c.bold}║   Token Budget Monitor — Autonomous Agent Simulation     ║${c.reset}`);
console.log(`${c.cyan}${c.bold}╚══════════════════════════════════════════════════════════╝${c.reset}`);
console.log(`${c.dim}  Budget: ${MAX_TOKENS.toLocaleString()} tokens | Cost cap: $1.00${c.reset}\n`);

let killed = false;

for (let i = 0; i < 20; i++) {
  if (killed) break;

  const sim = simulateTurn(i);
  const record = tracker.recordTurn(sim);
  const usage = tracker.getCumulativeUsage();
  const cost = tracker.getCostEstimate();

  // Header
  const phase = i < 10 ? `${c.green}HEALTHY` : i < 15 ? `${c.yellow}DEGRADING` : `${c.red}ROGUE`;
  console.log(`${c.bold}  Turn ${String(i + 1).padStart(2)} ${c.dim}│${c.reset} ${phase}${c.reset} ${c.dim}│${c.reset} ${c.magenta}${sim.tool}${c.reset}(${c.dim}${sim.toolArgs}${c.reset})`);

  // Per-turn stats
  console.log(`${c.dim}         │ in:${sim.input} out:${sim.output} reason:${sim.reasoning} → total:${record.total}${c.reset}`);

  // Budget bar
  const { percentUsed, remaining } = budget.checkBudget(usage, cost);
  console.log(`${c.dim}         │${c.reset} ${bar(percentUsed)} ${c.dim}(${remaining.toLocaleString()} remaining)${c.reset}`);

  // Cost
  console.log(`${c.dim}         │ cost: $${cost.total.toFixed(2)}${c.reset}`);

  // Kill-switch
  const { safe, violations } = killSwitch.evaluate(record, cost);
  if (!safe) {
    killed = true;
    console.log(`\n${c.bgRed}${c.white}${c.bold}  ⛔ KILL-SWITCH TRIPPED at turn ${i + 1}  ${c.reset}`);
    violations.forEach(v => console.log(`  ${c.red}  → ${v}${c.reset}`));
  }

  // Anomaly detection every 5 turns
  if ((i + 1) % 5 === 0) {
    const analysis = detector.analyze(tracker.getHistory());
    if (analysis.anomalies.length > 0) {
      console.log(`${c.dim}         │${c.reset} ${c.yellow}anomalies: ${analysis.anomalies.join('; ')}${c.reset}`);
      console.log(`${c.dim}         │${c.reset} ${c.yellow}recommendation: ${analysis.recommendation}${c.reset}`);
    }
  }

  console.log('');
}

// Summary
const final = tracker.getCumulativeUsage();
const finalCost = tracker.getCostEstimate();
console.log(`${c.cyan}${c.bold}── Session Summary ─────────────────────────────────────────${c.reset}`);
console.log(`  ${c.bold}Turns:${c.reset}     ${tracker.turnCount}`);
console.log(`  ${c.bold}Tokens:${c.reset}    ${final.total.toLocaleString()} (in:${final.input.toLocaleString()} out:${final.output.toLocaleString()} reasoning:${final.reasoning.toLocaleString()})`);
console.log(`  ${c.bold}Est. cost:${c.reset} $${finalCost.total.toFixed(2)}`);
console.log(`  ${c.bold}Outcome:${c.reset}   ${killed ? `${c.red}KILLED by circuit breaker${c.reset}` : `${c.green}Completed${c.reset}`}`);
console.log('');
