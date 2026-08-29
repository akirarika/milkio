import chalk from "chalk";
import consola from "consola";

const FALLBACK_SPEED = 4800;
const FALLBACK_CAP = 0.98;
const RENDER_INTERVAL = 120;
const CREEP_K = 1.5;
const MAX_RENDER_GAP = 400;

type ActiveStage = {
  weight: number;
  done: number;
  total: number;
  creep: number;
};

type ScopeState = {
  completedUnits: number;
  activeStage: ActiveStage | undefined;
};

export const progress = {
  rate: 0,
  current: 0,
  message: "",
  timeStart: 0,
  time: 0,
  timeWaste: 0,
  intervalId: undefined as Timer | undefined,
  usingStages: false,
  totalUnits: 0,
  scopes: new Map<string, ScopeState>(),
  lastRenderedPermille: -1,
  lastRenderAt: 0,

  open(message: string) {
    progress.message = message;
    progress.timeStart = Date.now();
    progress.current = 0;
    progress.rate = 0;
    progress.time = 0;
    progress.timeWaste = 0;
    progress.usingStages = false;
    progress.totalUnits = 0;
    progress.scopes = new Map();
    progress.lastRenderedPermille = -1;
    progress.lastRenderAt = 0;

    consola.start(`[${getRate()}] ${message}`);

    progress.intervalId = setInterval(() => {
      progress.time += RENDER_INTERVAL;
      const dt = RENDER_INTERVAL / 1000;
      for (const state of progress.scopes.values()) {
        if (state.activeStage) {
          state.activeStage.creep += (1 - state.activeStage.creep) * CREEP_K * dt;
          state.activeStage.creep = Math.min(state.activeStage.creep, 0.995);
        }
      }
      progress.update();
    }, RENDER_INTERVAL);
  },

  configure(options: { totalUnits: number }) {
    progress.usingStages = options.totalUnits > 0;
    progress.totalUnits = options.totalUnits;
    progress.scopes = new Map();
  },

  stage(scope: string, name: string, weight: number) {
    if (progress.totalUnits <= 0) return;
    progress.usingStages = true;
    const state = progress.scopes.get(scope) ?? { completedUnits: 0, activeStage: undefined };
    if (state.activeStage) {
      state.completedUnits += state.activeStage.weight;
    }
    state.activeStage = { weight, done: 0, total: 0, creep: 0 };
    progress.scopes.set(scope, state);
  },

  setTotal(scope: string, total: number) {
    const state = progress.scopes.get(scope);
    if (state?.activeStage) state.activeStage.total = total;
  },

  tick(scope: string, count = 1) {
    const state = progress.scopes.get(scope);
    if (state?.activeStage) state.activeStage.done += count;
  },

  completeStage(scope: string) {
    const state = progress.scopes.get(scope);
    if (state?.activeStage) {
      state.completedUnits += state.activeStage.weight;
      state.activeStage = undefined;
    }
  },

  update() {
    let current: number;
    if (progress.usingStages && progress.totalUnits > 0) {
      let value = 0;
      for (const state of progress.scopes.values()) {
        let v = state.completedUnits;
        if (state.activeStage) {
          const inner = state.activeStage.total > 0
            ? Math.min(state.activeStage.done / state.activeStage.total, 1)
            : state.activeStage.creep;
          v += state.activeStage.weight * inner;
        }
        value += v;
      }
      current = Math.min(value / progress.totalUnits, 1);
      if (progress.timeWaste === 0 && current > 0.4) {
        progress.timeWaste = (Date.now() - progress.timeStart) / 1000;
      }
    } else {
      current = 1 - Math.exp((-1 * progress.time) / FALLBACK_SPEED);
      current = Math.min(current, FALLBACK_CAP);
    }

    const permille = Math.floor(current * 1000);
    const now = Date.now();
    const shouldRender = permille !== progress.lastRenderedPermille || now - progress.lastRenderAt > MAX_RENDER_GAP;
    if (shouldRender) {
      progress.lastRenderedPermille = permille;
      progress.lastRenderAt = now;
      progress.rate = permille;
      progress.current = current;
      consola.start(chalk.gray(`[${getRate()}] ${progress.message}`));
    }
  },

  async close(message: string) {
    clearInterval(progress.intervalId);
    const p = Math.ceil(progress.current * 1000);
    for (let index = 0; index < 32; index++) {
      await Bun.sleep(1000 / 60);
      progress.rate = Math.ceil(p + ((1000 - p) / 32) * index);
    }
    progress.rate = 1000;
    progress.current = 1;
    progress.scopes = new Map();

    consola.success(chalk.gray(`[100.0%] ${message}`));
  },
};

export function getRate() {
  let rate = progress.rate / 10;
  if (rate > 100) rate = 100;
  return `${rate.toFixed(1)}%`;
}
