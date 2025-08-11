import { realtimeManager } from '@/utils/supabase/realtime-client';
import { realtimeToasts } from '@/lib/toast';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { realtime, success, warning } from './logger';

/**
 * Subscription wrapper utilities for easier real-time integration
 * Provides a cleaner API for components to subscribe to real-time events
 */

export interface SubscriptionConfig {
  channelName: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  filter?: string;
  onEvent: (payload: RealtimePostgresChangesPayload<any>) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface SubscriptionHandle {
  channelName: string;
  unsubscribe: () => Promise<void>;
  isActive: () => boolean;
}

/**
 * Subscribe to a table with automatic error handling and toast notifications
 */
export async function subscribeToTable(
  config: SubscriptionConfig,
): Promise<SubscriptionHandle> {
  const {
    channelName,
    table,
    event,
    filter,
    onEvent,
    onError,
    onConnect,
    onDisconnect,
  } = config;

  try {
    realtime(`Creating subscription: ${channelName} for ${table} ${event}`);

    const channel = await realtimeManager.subscribe(
      channelName,
      event,
      table,
      (payload) => {
        try {
          realtime(`${channelName} received ${event} event:`, payload);
          onEvent(payload);
        } catch (error) {
          console.error(`❌ Error in ${channelName} event handler:`, error);
          onError?.(error as Error);
        }
      },
      filter,
    );

    // Set up connection status monitoring
    let lastConnectionStatus = false;
    const checkConnection = () => {
      const status = realtimeManager.getConnectionStatus();
      const isCurrentlyConnected = status.isConnected;

      // Only trigger callbacks if status actually changed
      if (isCurrentlyConnected && !lastConnectionStatus) {
        onConnect?.();
        // Only show toast if explicitly requested
        // realtimeToasts.connected();
      } else if (
        !isCurrentlyConnected &&
        lastConnectionStatus &&
        status.error
      ) {
        onDisconnect?.();
        // Only show toast if explicitly requested
        // realtimeToasts.disconnected();
      }

      lastConnectionStatus = isCurrentlyConnected;
    };

    // Check connection status immediately and then periodically
    checkConnection();
    const connectionInterval = setInterval(checkConnection, 5000);

    return {
      channelName,
      unsubscribe: async () => {
        try {
          clearInterval(connectionInterval);
          await realtimeManager.unsubscribe(channelName);
          success(`Successfully unsubscribed from ${channelName}`);
        } catch (error) {
          console.error(`❌ Error unsubscribing from ${channelName}:`, error);
          throw error;
        }
      },
      isActive: () => {
        const activeChannels = realtimeManager.getActiveChannels();
        return activeChannels.includes(channelName);
      },
    };
  } catch (error) {
    console.error(`❌ Failed to create subscription ${channelName}:`, error);
    // Only show toast if explicitly requested
    // realtimeToasts.error(
    //   error instanceof Error ? error.message : 'Subscription failed',
    // );
    onError?.(error as Error);
    throw error;
  }
}

/**
 * Subscribe to tasks table changes
 */
export async function subscribeToTasks(
  userId: string,
  onEvent: (payload: RealtimePostgresChangesPayload<any>) => void,
  onError?: (error: Error) => void,
): Promise<SubscriptionHandle> {
  return subscribeToTable({
    channelName: `tasks-${userId}`,
    table: 'tasks',
    event: 'ALL',
    filter: `user_id=eq.${userId}`,
    onEvent,
    onError,
            onConnect: () => success('Tasks subscription connected'),
        onDisconnect: () => warning('Tasks subscription disconnected'),
  });
}

/**
 * Subscribe to habits table changes
 */
export async function subscribeToHabits(
  userId: string,
  onEvent: (payload: RealtimePostgresChangesPayload<any>) => void,
  onError?: (error: Error) => void,
): Promise<SubscriptionHandle> {
  return subscribeToTable({
    channelName: `habits-${userId}`,
    table: 'habits',
    event: 'ALL',
    filter: `user_id=eq.${userId}`,
    onEvent,
    onError,
            onConnect: () => success('Habits subscription connected'),
        onDisconnect: () => warning('Habits subscription disconnected'),
  });
}

/**
 * Subscribe to habit events table changes
 */
export async function subscribeToHabitEvents(
  userId: string,
  onEvent: (payload: RealtimePostgresChangesPayload<any>) => void,
  onError?: (error: Error) => void,
): Promise<SubscriptionHandle> {
  return subscribeToTable({
    channelName: `habit-events-${userId}`,
    table: 'habit_events',
    event: 'ALL',
    filter: `user_id=eq.${userId}`,
    onEvent,
    onError,
    onConnect: () => success('Habit events subscription connected'),
    onDisconnect: () =>
      warning('Habit events subscription disconnected'),
  });
}

/**
 * Subscribe to analytics-relevant table changes
 */
export async function subscribeToAnalytics(
  userId: string,
  onEvent: (payload: RealtimePostgresChangesPayload<any>) => void,
  onError?: (error: Error) => void,
): Promise<SubscriptionHandle[]> {
  const subscriptions = await Promise.all([
    subscribeToTasks(userId, onEvent, onError),
    subscribeToHabits(userId, onEvent, onError),
    subscribeToHabitEvents(userId, onEvent, onError),
  ]);

  return subscriptions;
}

/**
 * Cleanup all subscriptions for a user
 */
export async function cleanupUserSubscriptions(userId: string): Promise<void> {
  try {
    const channelNames = [
      `tasks-${userId}`,
      `habits-${userId}`,
      `habit-events-${userId}`,
    ];

    for (const channelName of channelNames) {
      try {
        await realtimeManager.unsubscribe(channelName);
        realtime(`Cleaned up ${channelName}`);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup ${channelName}:`, error);
      }
    }

    success(`Cleaned up all subscriptions for user ${userId}`);
  } catch (error) {
    console.error(`❌ Error cleaning up user subscriptions:`, error);
    throw error;
  }
}

/**
 * Get subscription status for debugging
 */
export function getSubscriptionStatus(): {
  activeChannels: string[];
  connectionStatus: ReturnType<typeof realtimeManager.getConnectionStatus>;
} {
  return {
    activeChannels: realtimeManager.getActiveChannels(),
    connectionStatus: realtimeManager.getConnectionStatus(),
  };
}
