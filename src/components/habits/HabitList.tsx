'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchHabits, deleteHabit } from '@/lib/habits';
import type { Habit } from '@/types/habit';
import type { SubscriptionHandle } from '@/lib/realtime-subscriptions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Trash2, Target, Eye, Loader2, AlertCircle, Edit3 } from 'lucide-react';

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
  const subscriptionRef = useRef<SubscriptionHandle | null>(null);

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

  // Real-time subscription setup
  useEffect(() => {
    let isSubscribed = true;
    
    const setupRealtimeSubscription = async () => {
      try {
        console.log('🔌 Setting up real-time subscription for habits...');
        
        // Use the same pattern as the working debug page
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        
        const channel = supabase
          .channel(`habits-${userId}-${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'habits',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              if (!isSubscribed) return;
              console.log('📡 INSERT event received:', payload);
              const newHabit = payload.new as Habit;
              setHabits((prev) => {
                // Check if habit already exists to prevent duplicates
                if (prev.some(habit => habit.id === newHabit.id)) {
                  console.log('📝 Habit already exists, skipping:', newHabit.name);
                  return prev;
                }
                console.log('📝 Adding new habit to state:', newHabit.name);
                return [newHabit, ...prev];
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'habits',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              if (!isSubscribed) return;
              console.log('📡 UPDATE event received:', payload);
              const updatedHabit = payload.new as Habit;
              
              // Check if this is a soft delete (deleted_at is set)
              if (updatedHabit.deleted_at) {
                console.log('📡 Soft DELETE detected:', updatedHabit.name);
                setHabits((prev) => {
                  console.log('📝 Removing soft-deleted habit from state:', updatedHabit.name);
                  return prev.filter((habit) => habit.id !== updatedHabit.id);
                });
              } else {
                // Regular update
                setHabits((prev) => {
                  console.log('📝 Updating habit in state:', updatedHabit.name);
                  return prev.map((habit) =>
                    habit.id === updatedHabit.id ? updatedHabit : habit,
                  );
                });
              }
            }
          )
          .subscribe((status) => {
            if (!isSubscribed) return;
            console.log('📡 Channel status:', status);
            setIsRealtimeConnected(status === 'SUBSCRIBED');
          });

        subscriptionRef.current = {
          channelName: `habits-${userId}-${Date.now()}`,
          unsubscribe: async () => {
            console.log('🧹 Cleaning up real-time subscription for habits');
            await supabase.removeChannel(channel);
          },
          isActive: () => true,
        };

        setIsRealtimeConnected(true);
        console.log('✅ Real-time subscription established for habits');
      } catch (error) {
        console.error('❌ Failed to setup real-time subscription:', error);
        setIsRealtimeConnected(false);
      }
    };

    if (userId) {
      setupRealtimeSubscription();
    }

    // Cleanup subscription on unmount
    return () => {
      isSubscribed = false;
      if (subscriptionRef.current) {
        console.log('🧹 Cleaning up real-time subscription for habits');
        subscriptionRef.current.unsubscribe().catch(console.error);
        subscriptionRef.current = null;
        setIsRealtimeConnected(false);
      }
    };
  }, [userId]);

  const handleDelete = async (habitId: string) => {
    if (!confirm('Are you sure you want to delete this habit?')) return;

    setDeletingHabitId(habitId);
    try {
      await deleteHabit(habitId);
      setHabits((prev) => prev.filter((habit) => habit.id !== habitId));
      onDelete?.();
    } catch (error) {
      setError('Failed to delete habit. Please try again later.');
      console.error('Error deleting habit:', error);
    } finally {
      setDeletingHabitId(null);
    }
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
              className={isRealtimeConnected ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}
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
                        handleDelete(habit.id);
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
    </div>
  );
}
