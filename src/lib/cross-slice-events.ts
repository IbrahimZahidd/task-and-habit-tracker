/**
 * Cross-Slice Event System
 * 
 * Provides a type-safe pub/sub system for communication between different
 * components/slices of the application. This allows components to communicate
 * without direct dependencies and enables real-time updates across the app.
 */

import { event } from './logger';

// Event types for different actions
export type TaskEventType = 
  | 'TASK_CREATED'
  | 'TASK_UPDATED' 
  | 'TASK_DELETED'
  | 'TASK_STATUS_CHANGED';

export type HabitEventType = 
  | 'HABIT_CREATED'
  | 'HABIT_UPDATED'
  | 'HABIT_DELETED'
  | 'HABIT_COMPLETED'
  | 'HABIT_UNCOMPLETED';

export type AnalyticsEventType = 
  | 'ANALYTICS_REFRESH_NEEDED'
  | 'ANALYTICS_DATA_UPDATED';

export type EventType = TaskEventType | HabitEventType | AnalyticsEventType;

// Event payload types
export interface TaskEventPayload {
  taskId: string;
  userId: string;
  taskTitle?: string;
  oldStatus?: string;
  newStatus?: string;
  timestamp: Date;
}

export interface HabitEventPayload {
  habitId: string;
  userId: string;
  habitName?: string;
  eventDate?: string;
  timestamp: Date;
}

export interface AnalyticsEventPayload {
  userId: string;
  trigger: 'task_change' | 'habit_change' | 'manual' | 'real_time';
  timestamp: Date;
}

export type EventPayload = TaskEventPayload | HabitEventPayload | AnalyticsEventPayload;

// Event listener type
export type EventListener = (payload: EventPayload) => void;

// Event subscription handle
export interface SubscriptionHandle {
  eventType: EventType;
  listener: EventListener;
  id: string;
}

/**
 * Cross-Slice Event Manager
 * 
 * Singleton class that manages event subscriptions and emissions
 * across different components of the application.
 */
class CrossSliceEventManager {
  private listeners: Map<EventType, Set<{ id: string; listener: EventListener }>> = new Map();
  private nextId = 1;

  /**
   * Subscribe to an event type
   * @param eventType The type of event to listen for
   * @param listener The callback function to execute when the event occurs
   * @returns A subscription handle for cleanup
   */
  subscribe(eventType: EventType, listener: EventListener): SubscriptionHandle {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const id = `sub_${this.nextId++}`;
    const listenerSet = this.listeners.get(eventType)!;
    listenerSet.add({ id, listener });

    event(`Subscribed to ${eventType} events (ID: ${id})`);

    return {
      eventType,
      listener,
      id,
    };
  }

  /**
   * Unsubscribe from an event type
   * @param handle The subscription handle returned from subscribe()
   */
  unsubscribe(handle: SubscriptionHandle): void {
    const listenerSet = this.listeners.get(handle.eventType);
    if (listenerSet) {
      for (const item of listenerSet) {
        if (item.id === handle.id) {
          listenerSet.delete(item);
          event(`Unsubscribed from ${handle.eventType} events (ID: ${handle.id})`);
          break;
        }
      }
    }
  }

  /**
   * Emit an event to all subscribed listeners
   * @param eventType The type of event to emit
   * @param payload The event payload data
   */
  emit(eventType: EventType, payload: EventPayload): void {
    const listenerSet = this.listeners.get(eventType);
    if (listenerSet) {
      event(`Emitting ${eventType} event to ${listenerSet.size} listeners`);
      listenerSet.forEach(({ listener }) => {
        try {
          listener(payload);
        } catch (error) {
          console.error(`🔗 Error in event listener for ${eventType}:`, error);
        }
      });
    } else {
      event(`No listeners for ${eventType} event`);
    }
  }

  /**
   * Get the number of listeners for a specific event type
   * @param eventType The event type to check
   * @returns The number of active listeners
   */
  getListenerCount(eventType: EventType): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  /**
   * Get all active event types
   * @returns Array of event types that have listeners
   */
  getActiveEventTypes(): EventType[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Clear all listeners (useful for testing or cleanup)
   */
  clearAll(): void {
    this.listeners.clear();
    event('Cleared all event listeners');
  }

  /**
   * Get debug information about current subscriptions
   */
  getDebugInfo(): Record<string, number> {
    const info: Record<string, number> = {};
    this.listeners.forEach((listenerSet, eventType) => {
      info[eventType] = listenerSet.size;
    });
    return info;
  }
}

// Create singleton instance
const eventManager = new CrossSliceEventManager();

// Export the singleton instance and helper functions
export const crossSliceEvents = {
  subscribe: eventManager.subscribe.bind(eventManager),
  unsubscribe: eventManager.unsubscribe.bind(eventManager),
  emit: eventManager.emit.bind(eventManager),
  getListenerCount: eventManager.getListenerCount.bind(eventManager),
  getActiveEventTypes: eventManager.getActiveEventTypes.bind(eventManager),
  clearAll: eventManager.clearAll.bind(eventManager),
  getDebugInfo: eventManager.getDebugInfo.bind(eventManager),
};

// Helper functions for common event patterns
export const taskEvents = {
  created: (taskId: string, userId: string, taskTitle: string) =>
    crossSliceEvents.emit('TASK_CREATED', {
      taskId,
      userId,
      taskTitle,
      timestamp: new Date(),
    }),

  updated: (taskId: string, userId: string, taskTitle?: string) =>
    crossSliceEvents.emit('TASK_UPDATED', {
      taskId,
      userId,
      taskTitle,
      timestamp: new Date(),
    }),

  deleted: (taskId: string, userId: string, taskTitle?: string) =>
    crossSliceEvents.emit('TASK_DELETED', {
      taskId,
      userId,
      taskTitle,
      timestamp: new Date(),
    }),

  statusChanged: (taskId: string, userId: string, oldStatus: string, newStatus: string) =>
    crossSliceEvents.emit('TASK_STATUS_CHANGED', {
      taskId,
      userId,
      oldStatus,
      newStatus,
      timestamp: new Date(),
    }),
};

export const habitEvents = {
  created: (habitId: string, userId: string, habitName: string) =>
    crossSliceEvents.emit('HABIT_CREATED', {
      habitId,
      userId,
      habitName,
      timestamp: new Date(),
    }),

  updated: (habitId: string, userId: string, habitName?: string) =>
    crossSliceEvents.emit('HABIT_UPDATED', {
      habitId,
      userId,
      habitName,
      timestamp: new Date(),
    }),

  deleted: (habitId: string, userId: string, habitName?: string) =>
    crossSliceEvents.emit('HABIT_DELETED', {
      habitId,
      userId,
      habitName,
      timestamp: new Date(),
    }),

  completed: (habitId: string, userId: string, habitName: string, eventDate: string) =>
    crossSliceEvents.emit('HABIT_COMPLETED', {
      habitId,
      userId,
      habitName,
      eventDate,
      timestamp: new Date(),
    }),

  uncompleted: (habitId: string, userId: string, habitName: string, eventDate: string) =>
    crossSliceEvents.emit('HABIT_UNCOMPLETED', {
      habitId,
      userId,
      habitName,
      eventDate,
      timestamp: new Date(),
    }),
};

export const analyticsEvents = {
  refreshNeeded: (userId: string, trigger: 'task_change' | 'habit_change' | 'manual' | 'real_time') =>
    crossSliceEvents.emit('ANALYTICS_REFRESH_NEEDED', {
      userId,
      trigger,
      timestamp: new Date(),
    }),

  dataUpdated: (userId: string, trigger: 'task_change' | 'habit_change' | 'manual' | 'real_time') =>
    crossSliceEvents.emit('ANALYTICS_DATA_UPDATED', {
      userId,
      trigger,
      timestamp: new Date(),
    }),
};

// Export types for use in other files
// Types are already exported above, no need to re-export 