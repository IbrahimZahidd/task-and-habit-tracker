'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchHabits, deleteHabit } from '@/lib/habits';
import type { Habit } from '@/types/habit';
import type { SubscriptionHandle } from '@/lib/realtime-subscriptions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Trash2, Target, Eye, Loader2, AlertCircle, Edit3 } from 'lucide-react';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import {
  useHabitEvents,
  useEventEmitters,
} from '@/hooks/use-cross-slice-events';
import { habitToasts } from '@/lib/toast';
import { event, realtime, success, warning, debug } from '@/lib/logger';

type HabitListProps = {
  userId: string;
  refreshKey?: any;
  onSelect?: (habitId: string) => void;
  selectedHabitId?: string | null;
  hideHeading?: boolean;
  onEdit?: (habit: Habit) => void;
  onDelete?: () => void;
};

const goalTypeConfig = {
  daily: { label: 'Daily', icon: '📅' },
  weekly: { label: 'Weekly', icon: '📊' },
  monthly: { label: 'Monthly', icon: '📈' },
};

export default function HabitList({
  userId,
  refreshKey,
  onSelect,
  selectedHabitId,
  hideHeading = false,
  onEdit,
  onDelete,
}: HabitListProps) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingHabitId, setDeletingHabitId] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const subscriptionRef = useRef<SubscriptionHandle | null>(null);

  // Cross-slice event integration
  const { emitHabitCreated, emitHabitUpdated, emitHabitDeleted } =
    useEventEmitters();

  // Listen to habit events from other components
  useHabitEvents((eventType, payload) => {
    event(`HabitList: Received ${eventType} event:`, payload);

    // Handle habit events from other components
    switch (eventType) {
      case 'HABIT_CREATED':
        // Refresh habits list when a new habit is created elsewhere
        if (payload.userId === userId) {
          debug('HabitList: Refreshing due to habit creation');
          fetchHabits(userId).then(setHabits).catch(console.error);
        }
        break;
      case 'HABIT_UPDATED':
        // Update specific habit in the list
        if (payload.userId === userId) {
          debug('HabitList: Updating habit due to external change');
          fetchHabits(userId).then(setHabits).catch(console.error);
        }
        break;
      case 'HABIT_DELETED':
        // Remove habit from the list
        if (payload.userId === userId) {
          debug('HabitList: Removing habit due to external deletion');
          const habitPayload = payload as any; // Type assertion for habit events
          setHabits((prev) =>
            prev.filter((habit) => habit.id !== habitPayload.habitId),
          );
        }
        break;
    }
  });

  useEffect(() => {
    const loadHabits = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchHabits(userId);
        setHabits(data);
      } catch (error) {
        setError('Failed to load habits. Please try again later.');
        console.error('Error fetching habits:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHabits();
  }, [userId, refreshKey]);

  // Real-time subscription setup using centralized subscription system
  useEffect(() => {
    let isSubscribed = true;

    const setupRealtimeSubscription = async () => {
      try {
        realtime('Setting up real-time subscription for habits...');

        // Use the centralized subscription system that's working for analytics
        const { subscribeToTable } = await import(
          '@/lib/realtime-subscriptions'
        );

        realtime('HabitList: About to subscribe to habits for userId:', userId);
        const uniqueChannelName = `habits-list-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const subscription = await subscribeToTable({
          channelName: uniqueChannelName,
          table: 'habits',
          event: 'ALL',
          filter: `user_id=eq.${userId}`,
          onEvent: (payload) => {
            if (!isSubscribed) return;
            realtime('HabitList: Real-time event received:', payload);
            debug('HabitList: Event details:', {
              eventType: payload.eventType,
              table: payload.table,
              new: payload.new,
              old: payload.old,
            });

            const { eventType, new: newRecord, old: oldRecord } = payload;
            const habit = newRecord as Habit;

            debug('HabitList: Event details:', {
              eventType,
              habitId: habit?.id,
              habitName: habit?.name,
              userId: habit?.user_id,
              deletedAt: habit?.deleted_at,
            });

            if (eventType === 'INSERT') {
              debug('HabitList: Processing INSERT event');
              setHabits((prev) => {
                // Check if habit already exists to prevent duplicates
                if (prev.some((h) => h.id === habit.id)) {
                  debug('Habit already exists, skipping:', habit.name);
                  return prev;
                }
                debug('Adding new habit to state:', habit.name);

                // Emit cross-slice event for habit creation
                emitHabitCreated({
                  habitId: habit.id,
                  userId: habit.user_id,
                  habitName: habit.name,
                  timestamp: new Date(),
                });

                // Don't show toast for real-time events to avoid duplicates
                debug(
                  'Skipping toast for real-time habit creation:',
                  habit.name,
                );

                return [habit, ...prev];
              });
            } else if (eventType === 'UPDATE') {
              debug('HabitList: Processing UPDATE event');

              // Check if this is a soft delete (deleted_at is set)
              if (habit.deleted_at) {
                realtime('Soft DELETE detected:', habit.name);
                setHabits((prev) => {
                  debug('Removing soft-deleted habit from state:', habit.name);

                  // Emit cross-slice event for habit deletion
                  emitHabitDeleted({
                    habitId: habit.id,
                    userId: habit.user_id,
                    habitName: habit.name,
                    timestamp: new Date(),
                  });

                  // Don't show toast for real-time events to avoid duplicates
                  debug(
                    'Skipping toast for real-time habit deletion:',
                    habit.name,
                  );

                  return prev.filter((h) => h.id !== habit.id);
                });
              } else {
                // Regular update
                setHabits((prev) => {
                  debug('Updating habit in state:', habit.name);

                  // Emit cross-slice event for habit update
                  emitHabitUpdated({
                    habitId: habit.id,
                    userId: habit.user_id,
                    habitName: habit.name,
                    timestamp: new Date(),
                  });

                  // Don't show toast for real-time events to avoid duplicates
                  debug(
                    '🔔 Skipping toast for real-time habit update:',
                    habit.name,
                  );

                  return prev.map((h) => (h.id === habit.id ? habit : h));
                });
              }
            }
          },
          onError: (error) => {
            console.error('❌ HabitList: Real-time subscription error:', error);
            setIsRealtimeConnected(false);
          },
          onConnect: () => {
            success('HabitList: Habits subscription connected');
            debug('HabitList: Subscription details:', {
              channelName: uniqueChannelName,
              userId,
              isSubscribed,
            });
            setIsRealtimeConnected(true);
            // Removed explicit toast call to prevent duplicate toasts
          },
          onDisconnect: () => {
            warning('HabitList: Habits subscription disconnected');
            setIsRealtimeConnected(false);
          },
        });

        subscriptionRef.current = subscription;
        setIsRealtimeConnected(true);
        success('HabitList: Real-time subscription established');
      } catch (error) {
        console.error(
          '❌ HabitList: Failed to setup real-time subscription:',
          error,
        );
        setIsRealtimeConnected(false);
      }
    };

    if (userId) {
      realtime(
        'HabitList: Starting real-time subscription for userId:',
        userId,
      );
      setupRealtimeSubscription();
    } else {
      warning('HabitList: No userId provided, skipping real-time subscription');
    }

    // Cleanup subscription on unmount
    return () => {
      isSubscribed = false;
      if (subscriptionRef.current) {
        realtime('HabitList: Cleaning up real-time subscription');
        subscriptionRef.current.unsubscribe().catch(console.error);
        subscriptionRef.current = null;
        setIsRealtimeConnected(false);
      }
    };
  }, [userId]);

  const handleDeleteClick = (habit: Habit) => {
    setHabitToDelete(habit);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!habitToDelete) return;

    const habitId = habitToDelete.id;
    const habitName = habitToDelete.name;

    setDeletingHabitId(habitId);
    setShowDeleteConfirm(false);

    try {
      await deleteHabit(habitId);
      setHabits((prev) => prev.filter((habit) => habit.id !== habitId));

      // Emit cross-slice event for manual habit deletion
      emitHabitDeleted({
        habitId: habitToDelete.id,
        userId: habitToDelete.user_id,
        habitName: habitToDelete.name,
        timestamp: new Date(),
      });

      // Show toast notification
      habitToasts.deleted(habitName);
      onDelete?.();
    } catch (error) {
      setError('Failed to delete habit. Please try again later.');
      console.error('Error deleting habit:', error);

      // Show error toast
      habitToasts.error(`Failed to delete ${habitName}`);
    } finally {
      setDeletingHabitId(null);
      setHabitToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setHabitToDelete(null);
  };

  const activeHabits = habits.filter((habit) => habit.is_active);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600 mb-4" />
        <p className="text-slate-600 font-medium">Loading habits...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
        <Button
          onClick={() => window.location.reload()}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      {!hideHeading && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold text-slate-800">Habits</h2>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
              {activeHabits.length}{' '}
              {activeHabits.length === 1 ? 'habit' : 'habits'}
            </Badge>
            <Badge
              variant={isRealtimeConnected ? 'default' : 'destructive'}
              className={
                isRealtimeConnected
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-red-100 text-red-800 border-red-200'
              }
            >
              {isRealtimeConnected ? '🟢 Live' : '🔴 Offline'}
            </Badge>
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeHabits.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-lg font-medium text-slate-600 mb-2">
            No habits found
          </h3>
          <p className="text-slate-500">
            Create your first habit to get started!
          </p>
        </div>
      )}

      {/* Habits Grid */}
      {activeHabits.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeHabits.map((habit) => (
            <Card
              key={habit.id}
              className={`hover:shadow-lg transition-all duration-200 border-slate-200 bg-white cursor-pointer ${
                selectedHabitId === habit.id
                  ? 'ring-2 ring-green-500 border-green-200'
                  : ''
              }`}
              onClick={() => onSelect && onSelect(habit.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-slate-800 line-clamp-2 flex-1">
                    {habit.name}
                  </h3>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEdit) onEdit(habit);
                      }}
                      className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1 h-auto transition-colors duration-200"
                      disabled={deletingHabitId === habit.id}
                      aria-label={`Edit habit: ${habit.name}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(habit);
                      }}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 h-auto transition-colors duration-200"
                      disabled={deletingHabitId === habit.id}
                      aria-label={`Delete habit: ${habit.name}`}
                    >
                      {deletingHabitId === habit.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    className="text-white border-0"
                    style={{ backgroundColor: habit.color }}
                  >
                    {goalTypeConfig[habit.goal_type].icon}{' '}
                    {goalTypeConfig[habit.goal_type].label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-slate-50 text-slate-700 border-slate-200"
                  >
                    <Target className="w-3 h-3 mr-1 flex-shrink-0" />
                    {habit.goal_target}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {habit.description && (
                  <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                    {habit.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    <span>Click to view details</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelect) onSelect(habit.id);
                    }}
                    className="text-xs h-7 px-2 transition-all duration-200 hover:bg-green-50 hover:border-green-200"
                    disabled={deletingHabitId === habit.id}
                  >
                    <Eye className="w-3 h-3 mr-1 flex-shrink-0" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Habit"
        message={`Are you sure you want to delete "${habitToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Habit"
        cancelText="Cancel"
        type="danger"
        isLoading={deletingHabitId !== null}
      />
    </div>
  );
}
