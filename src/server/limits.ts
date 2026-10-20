export class Limiter {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private max: number) {}

  async use<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

export const externalLimiter = new Limiter(Number(process.env.BCF_MAX_EXTERNAL_CALLS || 3));
