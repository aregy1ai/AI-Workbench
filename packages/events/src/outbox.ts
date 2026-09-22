/**
 * AI Workbench - Transactional Outbox Pattern & Event Bus
 * Sprint 2: Core Run Engine
 */

export interface OutboxEvent {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  publishedAt?: string;
}

export class OutboxManager {
  private events: OutboxEvent[] = [];

  public recordEvent(
    tenantId: string,
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>
  ): OutboxEvent {
    const event: OutboxEvent = {
      id: `evt_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
      tenantId,
      eventType,
      aggregateType,
      aggregateId,
      payload,
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  /**
   * Sweeps unpublished events, publishes to bus, and marks published
   */
  public async publishOutbox(): Promise<OutboxEvent[]> {
    const unpublished = this.events.filter((e) => !e.publishedAt);
    const now = new Date().toISOString();

    for (const event of unpublished) {
      // Broadcast/publish
      event.publishedAt = now;
    }

    return unpublished;
  }

  public getEvents(tenantId?: string): OutboxEvent[] {
    if (tenantId) {
      return this.events.filter((e) => e.tenantId === tenantId);
    }
    return [...this.events];
  }

  public clear(): void {
    this.events = [];
  }
}

export const outboxManager = new OutboxManager();
