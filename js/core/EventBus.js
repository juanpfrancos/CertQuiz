// Minimal pub/sub (Observer pattern). Handlers errors are isolated so one
// faulty subscriber never breaks the emitter.
export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    for (const handler of [...(this.handlers.get(event) || [])]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] ${event}:`, err);
      }
    }
  }
}
