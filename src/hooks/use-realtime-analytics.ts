import { useEffect, useRef, useCallback } from 'react';
import { subscribeToAnalytics } from '@/lib/realtime-subscriptions';
import { analyticsToasts } from '@/lib/toast';
import type { SubscriptionHandle } from '@/lib/realtime-subscriptions';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useState } from 'react';
import { analytics, realtime, success, error } from '@/lib/logger';

interface UseRealtimeAnalyticsOptions {
  userId: string;
  onDataChange?: () => void;
  enabled?: boolean;
}

interface UseRealtimeAnalyticsReturn {
  isConnected: boolean;
  refreshAnalytics: () => void;
}

/**
 * Hook for real-time analytics updates
 * Subscribes to tasks, habits, and habit_events table changes
 * and triggers analytics refresh when data changes
 */
export function useRealtimeAnalytics({
  userId,
  onDataChange,
  enabled = true,
}: UseRealtimeAnalyticsOptions): UseRealtimeAnalyticsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRefs = useRef<SubscriptionHandle[]>([]);
  const isSubscribed = useRef(true);
  const onDataChangeRef = useRef(onDataChange);

  // Update ref when onDataChange changes
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  // Debounced refresh function to prevent excessive API calls
  const debouncedRefresh = useCallback(
    debounce(() => {
      if (!isSubscribed.current) return;

      analytics('Real-time analytics refresh triggered');
      // Removed analytics toast to prevent overlapping with task/habit toasts
      onDataChangeRef.current?.();
    }, 1000), // 1 second debounce
    [],
  );

  // Handle real-time events
  const handleRealtimeEvent = useCallback(
    (payload: RealtimePostgresChangesPayload<any>) => {
      if (!isSubscribed.current) return;

      analytics('Analytics-relevant real-time event:', {
        table: payload.table,
        eventType: payload.eventType,
        recordId: (payload.new as any)?.id || (payload.old as any)?.id,
      });

      // Trigger debounced refresh
      debouncedRefresh();
    },
    [],
  );

  // Set up real-time subscriptions
  useEffect(() => {
    if (!enabled || !userId) return;

    let mounted = true;

    const setupSubscriptions = async () => {
      try {
        realtime('Setting up real-time analytics subscriptions...');

        const subscriptions = await subscribeToAnalytics(
          userId,
          handleRealtimeEvent,
          (error) => {
            console.error('❌ Analytics subscription error:', error);
            analyticsToasts.error('update', error.message);
          },
        );

        if (mounted) {
          subscriptionRefs.current = subscriptions;
          setIsConnected(true);
          success('Real-time analytics subscriptions established');
        }
      } catch (error) {
        console.error('❌ Failed to setup analytics subscriptions:', error);
        if (mounted) {
          setIsConnected(false);
          analyticsToasts.error(
            'setup',
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      }
    };

    setupSubscriptions();

    // Cleanup function
    return () => {
      mounted = false;
      isSubscribed.current = false;

      const cleanup = async () => {
        try {
          realtime('Cleaning up real-time analytics subscriptions...');

          for (const subscription of subscriptionRefs.current) {
            await subscription.unsubscribe();
          }

          subscriptionRefs.current = [];
          setIsConnected(false);
          success('Real-time analytics subscriptions cleaned up');
        } catch (error) {
          console.error('❌ Error cleaning up analytics subscriptions:', error);
        }
      };

      cleanup();
    };
  }, [userId, enabled]);

  // Manual refresh function
  const refreshAnalytics = useCallback(() => {
          analytics('Manual analytics refresh triggered');
    onDataChange?.();
  }, [onDataChange]);

  return {
    isConnected,
    refreshAnalytics,
  };
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
