import chalk from "chalk";
import consola from "consola";

export const progress = {
  rate: 0,
  timeStart: 0,
  current: 0,
  timeWaste: 0,
  time: 0,
  intervalId: undefined as Timer | undefined,
  textIntervalId: undefined as Timer | undefined,
  open(message: string) {
    progress.timeStart = Date.now();
    progress.current = 0;
    const speed = 4800;
    const intervalFrequency = 1000 / 60;
    const staticPercentage = 0.4;
    progress.timeWaste = 0;
    progress.time = 0;
    progress.rate = 0;
    consola.start(`[${getRate()}] ${message}`);

    progress.intervalId = setInterval(() => {
      progress.time += intervalFrequency;
      progress.current = 1 - Math.exp((-1 * progress.time) / speed);
      if (!progress.timeWaste && progress.current > staticPercentage) {
        const timeEnd = Date.now();
        progress.timeWaste = (timeEnd - progress.timeStart) / 1000;
      }
      progress.rate = Math.floor(progress.current * 1000);
    }, intervalFrequency);
    progress.textIntervalId = setInterval(() => {
      if (progress.rate < 1000) consola.start(chalk.gray(`${`[${getRate()}] `}${message}`));
    }, 334);
  },
  async close(message: string) {
    clearInterval(progress.intervalId);
    clearInterval(progress.textIntervalId);
    const p = Math.ceil(progress.current * 1000);
    for (let index = 0; index < 32; index++) {
      await Bun.sleep(1000 / 60);
      progress.rate = Math.ceil(p + ((1000 - p) / 32) * index);
    }
    progress.rate = 1000;

    consola.success(chalk.gray(`[100.0%] ${message}`));
  },
};

export function getRate() {
  let rate = progress.rate++ / 10;
  if (rate > 100) rate = 100;
  return `${rate.toFixed(1)}%`;
}
