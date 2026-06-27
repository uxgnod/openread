export class TranslationQueue {
  private activeCount = 0
  private readonly tasks: Array<() => void> = []

  constructor(private readonly concurrency: number) {}

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        this.activeCount += 1
        task()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.activeCount -= 1
            this.runNext()
          })
      }

      this.tasks.push(run)
      this.runNext()
    })
  }

  private runNext(): void {
    if (this.activeCount >= this.concurrency) {
      return
    }

    const next = this.tasks.shift()
    if (!next) {
      return
    }

    next()
  }
}

export async function withRetries<T>(
  task: () => Promise<T>,
  options: { retries: number; baseDelayMs: number },
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await task()
    }
    catch (error) {
      lastError = error
      if (attempt < options.retries) {
        await sleep(options.baseDelayMs * (attempt + 1))
      }
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
