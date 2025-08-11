'use client';

import { signOut } from '@/actions/auth';
import { useRouter } from 'next/navigation';
import TaskForm from '@/components/tasks/TaskForm';
import TaskList from '@/components/tasks/TaskList';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import {
  Plus,
  LogOut,
  LayoutList,
  Repeat,
  ArrowLeft,
  List,
  Eye,
  Loader2,
  BarChart3,
  Wifi,
  WifiOff,
} from 'lucide-react';
import HabitForm from '@/components/habits/HabitForm';
import HabitList from '@/components/habits/HabitList';
import HabitDetails from '@/components/habits/HabitDetails';
import type { Habit } from '@/types/habit';
import HabitTracker from '@/components/habits/HabitTracker';
import ModernAnalyticsDashboard from '@/components/analytics/ModernAnalyticsDashboard';
import { useRealtimeAnalytics } from '@/hooks/use-realtime-analytics';
import { useHabitEvents, useAnalyticsEvents, useTaskEvents, useEventEmitters } from '@/hooks/use-cross-slice-events';
import type {
  StreakData,
  CompletionRateData,
  AnalyticsSummary as AnalyticsSummaryType,
} from '@/types/analytics';
import { event, analytics } from '@/lib/logger';

export default function DashboardPage() {
  const [session, setSession] = useState<any>(null);
  const [activeSlice, setActiveSlice] = useState<
    'tasks' | 'habits' | 'analytics'
  >('tasks');
  const [tasksUpdatedAt, setTasksUpdatedAt] = useState(Date.now());
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [habitsUpdatedAt, setHabitsUpdatedAt] = useState(Date.now());
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [habitViewMode, setHabitViewMode] = useState<'list' | 'detail'>('list');
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Analytics state
  const [streaksData, setStreaksData] = useState<StreakData[]>([]);
  const [completionData, setCompletionData] = useState<CompletionRateData[]>(
    [],
  );
  const [summaryData, setSummaryData] = useState<AnalyticsSummaryType | null>(
    null,
  );
  const [selectedPeriod, setSelectedPeriod] = useState<
    'week' | 'month' | 'year'
  >('month');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [lastRealTimeUpdate, setLastRealTimeUpdate] = useState<Date | null>(
    null,
  );

  const router = useRouter();

  // Cross-slice event integration
  const { emitAnalyticsRefreshNeeded } = useEventEmitters();
  
  // Listen to task events and trigger analytics refresh
  useTaskEvents((eventType, payload) => {
    event(`Dashboard: Received ${eventType} event:`, payload);
    
    // Trigger analytics refresh when tasks change
    if (payload.userId === session?.user?.id) {
      analytics('Dashboard: Triggering analytics refresh due to task change');
      emitAnalyticsRefreshNeeded({
        userId: payload.userId,
        trigger: 'task_change',
        timestamp: new Date()
      });
      
      // Refresh analytics data if we're on the analytics tab
      if (activeSlice === 'analytics') {
        fetchAnalyticsData();
      }
    }
  });
  
  // Listen to habit events and trigger analytics refresh
  useHabitEvents((eventType, payload) => {
    event(`Dashboard: Received ${eventType} event:`, payload);
    
    // Trigger analytics refresh when habits change
    if (payload.userId === session?.user?.id) {
      analytics('Dashboard: Triggering analytics refresh due to habit change');
      emitAnalyticsRefreshNeeded({
        userId: payload.userId,
        trigger: 'habit_change',
        timestamp: new Date()
      });
      
      // Refresh analytics data if we're on the analytics tab
      if (activeSlice === 'analytics') {
        fetchAnalyticsData();
      }
    }
  });
  
  // Listen to analytics events
  useAnalyticsEvents((eventType, payload) => {
    event(`Dashboard: Received ${eventType} event:`, payload);
    
    // Handle analytics events
    switch (eventType) {
      case 'ANALYTICS_REFRESH_NEEDED':
        analytics('Dashboard: Analytics refresh needed');
        if (activeSlice === 'analytics') {
          fetchAnalyticsData();
        }
        break;
      case 'ANALYTICS_DATA_UPDATED':
        analytics('Dashboard: Analytics data updated');
        setLastRealTimeUpdate(new Date());
        break;
    }
  });

  // Real-time analytics hook
  const { isConnected: analyticsConnected } = useRealtimeAnalytics({
    userId: session?.user?.id || '',
    onDataChange: () => {
      analytics('Dashboard: Real-time analytics update triggered');
      setLastRealTimeUpdate(new Date());
      // Always refresh analytics data when real-time events occur
      fetchAnalyticsData();
    },
    enabled: !!session?.user?.id,
  });

  useEffect(() => {
    const supabase = createClient();
    const getSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
        } else {
          setSession(session);
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();
  }, []);

  // Fetch analytics data when analytics tab is active or when period changes
  useEffect(() => {
    if (activeSlice === 'analytics' && session?.user?.id) {
      fetchAnalyticsData();
    }
  }, [activeSlice, selectedPeriod]);

  // Load initial analytics data for quick insights
  useEffect(() => {
    if (session?.user?.id) {
      const loadInitialAnalytics = async () => {
        try {
          const summaryResponse = await fetch('/api/analytics/summary');
          if (summaryResponse.ok) {
            const summaryResult = await summaryResponse.json();
            setSummaryData(summaryResult);
          }
        } catch (error) {
          console.error('Error loading initial analytics:', error);
        }
      };
      loadInitialAnalytics();
    }
  }, [session?.user?.id]);

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/sign-in');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  // Task slice handlers
  const onTaskCreated = () => {
    setTasksUpdatedAt(Date.now());
    setShowTaskForm(false);
  };

  // Habit slice handlers
  const onHabitCreated = () => {
    setHabitsUpdatedAt(Date.now());
    setShowHabitForm(false);
    // Refresh analytics data when habits are modified
    if (session?.user?.id) {
      fetchAnalyticsData();
    }
  };

  const onHabitUpdated = () => {
    setHabitsUpdatedAt(Date.now());
    setEditingHabit(null);
    setShowHabitForm(false);
    // Refresh analytics data when habits are modified
    if (session?.user?.id) {
      fetchAnalyticsData();
    }
  };

  const onHabitDeleted = () => {
    setHabitsUpdatedAt(Date.now());
    // Refresh analytics data when habits are deleted
    if (session?.user?.id) {
      fetchAnalyticsData();
    }
  };

  // Handle habit selection and view switching
  const handleHabitSelect = (habitId: string) => {
    setSelectedHabitId(habitId);
    setHabitViewMode('detail');
  };

  const handleBackToHabitList = () => {
    setHabitViewMode('list');
    setSelectedHabitId(null);
  };

  // Analytics functions
  const fetchAnalyticsData = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const [streaksResponse, completionResponse, summaryResponse] =
        await Promise.all([
          fetch('/api/analytics/streaks'),
          fetch(`/api/analytics/completion-rates?period=${selectedPeriod}`),
          fetch('/api/analytics/summary'),
        ]);

      if (
        !streaksResponse.ok ||
        !completionResponse.ok ||
        !summaryResponse.ok
      ) {
        throw new Error('Failed to fetch analytics data');
      }

      const [streaksResult, completionResult, summaryResult] =
        await Promise.all([
          streaksResponse.json(),
          completionResponse.json(),
          summaryResponse.json(),
        ]);

      setStreaksData(streaksResult.streaks || []);
      setCompletionData(completionResult.completionRates || []);
      setSummaryData(summaryResult);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setAnalyticsError(
        err instanceof Error ? err.message : 'Failed to load analytics',
      );
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleRefreshAnalytics = () => {
    fetchAnalyticsData();
  };

  const handleExportCSV = async (
    type: 'all' | 'streaks' | 'completion-rates' | 'summary' = 'all',
  ) => {
    try {
      const url = `/api/analytics/export/csv?type=${type}&period=${selectedPeriod}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `analytics-${type}-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
          <p className="text-slate-600 text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 text-lg font-medium mb-2">
            Please sign in first.
          </p>
          <button
            onClick={() => router.push('/sign-in')}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 bg-white/80 backdrop-blur-lg border-r border-slate-200 shadow-lg flex flex-col items-center py-8 px-2 md:px-6 gap-8">
        <div className="flex flex-col items-center gap-4 w-full">
          <button
            className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-semibold text-lg md:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              activeSlice === 'tasks'
                ? 'bg-blue-600 text-white shadow-lg focus:ring-blue-500'
                : 'hover:bg-slate-100 text-slate-700 focus:ring-slate-300'
            }`}
            onClick={() => setActiveSlice('tasks')}
            aria-label="Switch to tasks view"
          >
            <LayoutList className="w-6 h-6 md:mr-2 flex-shrink-0" />
            <span className="hidden md:inline">Tasks</span>
          </button>
          <button
            className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-semibold text-lg md:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              activeSlice === 'habits'
                ? 'bg-green-600 text-white shadow-lg focus:ring-green-500'
                : 'hover:bg-slate-100 text-slate-700 focus:ring-slate-300'
            }`}
            onClick={() => setActiveSlice('habits')}
            aria-label="Switch to habits view"
          >
            <Repeat className="w-6 h-6 md:mr-2 flex-shrink-0" />
            <span className="hidden md:inline">Habits</span>
          </button>
          <button
            className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-semibold text-lg md:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              activeSlice === 'analytics'
                ? 'bg-purple-600 text-white shadow-lg focus:ring-purple-500'
                : 'hover:bg-slate-100 text-slate-700 focus:ring-slate-300'
            }`}
            onClick={() => setActiveSlice('analytics')}
            aria-label="Switch to analytics view"
          >
            <BarChart3 className="w-6 h-6 md:mr-2 flex-shrink-0" />
            <span className="hidden md:inline">Analytics</span>
          </button>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="hidden md:inline">Sign Out</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-auto">
        {activeSlice === 'tasks' && (
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
                  My Tasks
                </h1>
                <p className="text-slate-600">
                  Organize and track your tasks efficiently
                </p>
              </div>
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full sm:w-auto"
                aria-label="Add new task"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="hidden md:inline">Add Task</span>
                <span className="md:hidden">Add Task</span>
              </button>
            </div>

            {/* Task Form - Collapsible */}
            {showTaskForm && (
              <div className="mb-8 bg-white rounded-xl shadow-lg border border-slate-200 p-6 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-slate-800">
                    Create New Task
                  </h2>
                  <button
                    onClick={() => setShowTaskForm(false)}
                    className="text-slate-500 hover:text-slate-700 text-xl px-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-300 rounded"
                    aria-label="Close task form"
                  >
                    ✕
                  </button>
                </div>
                <TaskForm
                  userId={session.user.id}
                  onTaskCreated={onTaskCreated}
                />
              </div>
            )}

            {/* Quick Analytics Summary */}
            <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-lg border border-purple-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  Quick Insights
                </h3>
                <button
                  onClick={() => setActiveSlice('analytics')}
                  className="text-purple-600 hover:text-purple-700 hover:cursor-pointer text-sm font-medium flex items-center gap-1"
                >
                  View Full Analytics
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {summaryData?.total_habits || 0}
                  </div>
                  <div className="text-sm text-slate-600">Total Habits</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {summaryData?.total_current_streaks || 0}
                  </div>
                  <div className="text-sm text-slate-600">Active Streaks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {summaryData?.average_completion_rate?.toFixed(1) || '0'}%
                  </div>
                  <div className="text-sm text-slate-600">Avg Completion</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {summaryData?.longest_overall_streak || 0}
                  </div>
                  <div className="text-sm text-slate-600">Best Streak</div>
                </div>
              </div>
            </div>

            {/* Task List */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              <TaskList userId={session.user.id} refreshKey={tasksUpdatedAt} />
            </div>
          </div>
        )}

        {activeSlice === 'habits' && (
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
                    My Habits
                  </h1>
                  <p className="text-slate-600">
                    Build and track your habits for a better you
                  </p>
                </div>
                {/* View Toggle Buttons - Only show when habit is selected */}
                {selectedHabitId && (
                  <div className="flex items-center gap-2 mt-4 sm:mt-0 sm:ml-8">
                    <button
                      onClick={() => setHabitViewMode('list')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        habitViewMode === 'list'
                          ? 'bg-green-100 text-green-700 border border-green-200 focus:ring-green-500'
                          : 'text-slate-600 hover:bg-slate-100 focus:ring-slate-300'
                      }`}
                      aria-label="Switch to list view"
                    >
                      <List className="w-4 h-4 flex-shrink-0" />
                      List View
                    </button>
                    <button
                      onClick={() => setHabitViewMode('detail')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        habitViewMode === 'detail'
                          ? 'bg-green-100 text-green-700 border border-green-200 focus:ring-green-500'
                          : 'text-slate-600 hover:bg-slate-100 focus:ring-slate-300'
                      }`}
                      aria-label="Switch to detail view"
                    >
                      <Eye className="w-4 h-4 flex-shrink-0" />
                      Detail View
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowHabitForm(!showHabitForm);
                  setEditingHabit(null);
                }}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 w-full sm:w-auto"
                aria-label="Add new habit"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="hidden md:inline">Add Habit</span>
                <span className="md:hidden">Add Habit</span>
              </button>
            </div>

            {/* Habit Form - Collapsible (Create) */}
            {showHabitForm && !editingHabit && (
              <div className="mb-8 bg-white rounded-xl shadow-lg border border-slate-200 p-6 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-slate-800">
                    Create New Habit
                  </h2>
                  <button
                    onClick={() => setShowHabitForm(false)}
                    className="text-slate-500 hover:text-slate-700 text-xl px-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-300 rounded"
                    aria-label="Close habit form"
                  >
                    ✕
                  </button>
                </div>
                <HabitForm
                  userId={session.user.id}
                  onHabitCreated={onHabitCreated}
                />
              </div>
            )}

            {/* Habit Form - Edit Mode */}
            {editingHabit && (
              <div className="mb-8 bg-white rounded-xl shadow-lg border border-slate-200 p-6 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-slate-800">
                    Edit Habit
                  </h2>
                  <button
                    onClick={() => setEditingHabit(null)}
                    className="text-slate-500 hover:text-slate-700 text-xl px-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-300 rounded"
                    aria-label="Close edit form"
                  >
                    ✕
                  </button>
                </div>
                <HabitForm
                  userId={session.user.id}
                  habit={editingHabit}
                  onHabitUpdated={onHabitUpdated}
                />
              </div>
            )}

            {/* Quick Analytics Summary */}
            <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-lg border border-purple-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  Quick Insights
                </h3>
                <button
                  onClick={() => setActiveSlice('analytics')}
                  className="text-purple-600 hover:text-purple-700 hover:cursor-pointer text-sm font-medium flex items-center gap-1"
                >
                  View Full Analytics
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {summaryData?.total_habits || 0}
                  </div>
                  <div className="text-sm text-slate-600">Total Habits</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {summaryData?.total_current_streaks || 0}
                  </div>
                  <div className="text-sm text-slate-600">Active Streaks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {summaryData?.average_completion_rate?.toFixed(1) || '0'}%
                  </div>
                  <div className="text-sm text-slate-600">Avg Completion</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {summaryData?.longest_overall_streak || 0}
                  </div>
                  <div className="text-sm text-slate-600">Best Streak</div>
                </div>
              </div>
            </div>

            {/* Habit Content - Toggle between List and Detail views */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
              {habitViewMode === 'list' ? (
                // List View
                <HabitList
                  userId={session.user.id}
                  refreshKey={habitsUpdatedAt}
                  onSelect={handleHabitSelect}
                  selectedHabitId={selectedHabitId}
                  onEdit={(habit) => {
                    setEditingHabit(habit);
                    setShowHabitForm(false);
                  }}
                  onDelete={onHabitDeleted}
                />
              ) : (
                // Detail View
                selectedHabitId && (
                  <div className="animate-in fade-in duration-300">
                    {/* Back Button */}
                    <div className="flex items-center gap-3 mb-6">
                      <button
                        onClick={handleBackToHabitList}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-3 py-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        aria-label="Back to habits list"
                      >
                        <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                        Back to Habits
                      </button>
                      <div className="h-4 w-px bg-slate-300" />
                      <span className="text-sm text-slate-500">
                        Habit Details & Tracker
                      </span>
                    </div>
                    {/* Habit Details */}
                    <div className="mb-8">
                      <HabitDetails
                        habitId={selectedHabitId}
                        onEdit={(habit) => {
                          setEditingHabit(habit);
                          setShowHabitForm(false);
                        }}
                      />
                    </div>
                    {/* Habit Tracker */}
                    <HabitTracker
                      habitId={selectedHabitId}
                      onEventToggle={() => {
                        if (session?.user?.id) {
                          fetchAnalyticsData();
                        }
                      }}
                    />
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {activeSlice === 'analytics' && (
          <div className="max-w-6xl mx-auto">
            {/* Real-time Status Indicator */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                  Real-time Analytics:
                </span>
                {analyticsConnected ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <Wifi className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Live Updates Active
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600">
                    <WifiOff className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Manual Refresh Only
                    </span>
                  </div>
                )}
              </div>
              
              {lastRealTimeUpdate && (
                <div className="text-xs text-slate-500">
                  Last update: {lastRealTimeUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>

            <ModernAnalyticsDashboard
              summaryData={summaryData}
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              onRefresh={handleRefreshAnalytics}
              onExport={() => handleExportCSV('all')}
              analyticsLoading={analyticsLoading}
              analyticsError={analyticsError}
              streaksData={streaksData}
              completionData={completionData}
            />
          </div>
        )}
      </main>
    </div>
  );
}
