/**
 * EventEmitter — Minimal publish/subscribe event bus for vanilla JS ES modules
 *
 * Provides a simple, dependency-free event system for decoupling components.
 * GameEngine and other modules emit state-change events; subscribers listen
 * without needing direct references.
 */
export default class EventEmitter {
  constructor() {
    /**
     * Map of event name → Set of subscriber callbacks
     * @type {Map<string, Set<Function>>}
     */
    this.#subscribers = new Map();
  }

  /**
   * Private storage for subscribers
   * @type {Map<string, Set<Function>>}
   */
  #subscribers;

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback to invoke when event fires
   */
  on(event, callback) {
    if (!this.#subscribers.has(event)) {
      this.#subscribers.set(event, new Set());
    }
    this.#subscribers.get(event).add(callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback to remove (must be same reference as passed to on())
   */
  off(event, callback) {
    if (this.#subscribers.has(event)) {
      this.#subscribers.get(event).delete(callback);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} event - Event name
   * @param {*} data - Data to pass to each subscriber
   */
  emit(event, data) {
    if (this.#subscribers.has(event)) {
      for (const callback of this.#subscribers.get(event)) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in subscriber for event "${event}":`, error);
        }
      }
    }
  }
}
