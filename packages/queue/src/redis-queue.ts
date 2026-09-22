/**
 * AI Workbench - Redis Streams & Durable Job Queue
 * Sprint 2: Core Run Engine
 */

import { Run } from "../../contracts/src/run";

export const QUEUE_NAMES = {
  QUEUE: "run:queue",
  PRIORITY: "run:priority",
  CANCEL: "run:cancel",
  RESUME: "run:resume",
  DEAD_LETTER: "run:dead-letter",
} as const;

export interface RunJob {
  jobId: string;
  runId: string;
  tenantId: string;
  cancellationEpoch: number;
  attempt: number;
  createdAt: string;
}

export class RedisQueueManager {
  private inMemoryQueue: Map<string, RunJob[]> = new Map();
  private deadLetterQueue: RunJob[] = [];
  public static readonly MAX_ATTEMPTS = 5;

  constructor() {
    this.inMemoryQueue.set(QUEUE_NAMES.QUEUE, []);
    this.inMemoryQueue.set(QUEUE_NAMES.PRIORITY, []);
    this.inMemoryQueue.set(QUEUE_NAMES.CANCEL, []);
    this.inMemoryQueue.set(QUEUE_NAMES.RESUME, []);
  }

  /**
   * Enqueues a new or resumed Run to run:queue
   */
  public async enqueueRun(run: Run): Promise<RunJob> {
    const job: RunJob = {
      jobId: `job_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
      runId: run.id,
      tenantId: run.tenantId,
      cancellationEpoch: run.cancellationEpoch,
      attempt: 0,
      createdAt: new Date().toISOString(),
    };

    const queue = this.inMemoryQueue.get(QUEUE_NAMES.QUEUE) || [];
    queue.push(job);
    this.inMemoryQueue.set(QUEUE_NAMES.QUEUE, queue);
    return job;
  }

  public async enqueueJob(job: RunJob): Promise<void> {
    const queue = this.inMemoryQueue.get(QUEUE_NAMES.QUEUE) || [];
    queue.push(job);
    this.inMemoryQueue.set(QUEUE_NAMES.QUEUE, queue);
  }

  public async popNext(queueName: string = QUEUE_NAMES.QUEUE): Promise<RunJob | undefined> {
    const queue = this.inMemoryQueue.get(queueName) || [];
    const item = queue.shift();
    this.inMemoryQueue.set(queueName, queue);
    return item;
  }

  public getQueueDepth(queueName: string = QUEUE_NAMES.QUEUE): number {
    return (this.inMemoryQueue.get(queueName) || []).length;
  }

  public getDeadLetters(): RunJob[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Handles job failure, retries up to MAX_ATTEMPTS then moves to Dead-Letter
   */
  public async handleJobFailure(
    job: RunJob,
    error: unknown
  ): Promise<{ deadLettered: boolean; remainingAttempts: number }> {
    if (job.attempt >= RedisQueueManager.MAX_ATTEMPTS) {
      this.deadLetterQueue.push({ ...job });
      return { deadLettered: true, remainingAttempts: 0 };
    }

    const retriedJob: RunJob = {
      ...job,
      attempt: job.attempt + 1,
    };
    await this.enqueueJob(retriedJob);
    return {
      deadLettered: false,
      remainingAttempts: RedisQueueManager.MAX_ATTEMPTS - retriedJob.attempt,
    };
  }

  public clear(): void {
    this.inMemoryQueue.forEach((val, key) => this.inMemoryQueue.set(key, []));
    this.deadLetterQueue = [];
  }
}

export const redisQueue = new RedisQueueManager();
