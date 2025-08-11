'use client';
import {
  BarChart3,
  TrendingUp,
  Target,
  Zap,
  Award,
  RefreshCw,
  Download,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { event, analytics } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StreakChart } from '@/components/analytics/StreakChart';
import { CompletionRateChart } from '@/components/analytics/CompletionRateChart';
import {
  useAnalyticsEvents,
  useEventEmitters,
} from '@/hooks/use-cross-slice-events';

interface AnalyticsSummaryData {
  total_habits: number;
  active_habits: number;
  total_tasks: number;
  active_tasks: number;
  average_completion_rate: number;
  total_current_streaks: number;
  longest_overall_streak: number;
  most_consistent_habit_name: string | null;
}

interface ModernAnalyticsDashboardProps {
  summaryData: AnalyticsSummaryData | null;
  selectedPeriod: 'week' | 'month' | 'year';
  onPeriodChange: (period: 'week' | 'month' | 'year') => void;
  onRefresh: () => void;
  onExport: () => void;
  analyticsLoading: boolean;
  analyticsError: string | null;
  streaksData: any[];
  completionData: any[];
}

export default function ModernAnalyticsDashboard({
  summaryData,
  selectedPeriod,
  onPeriodChange,
  onRefresh,
  onExport,
  analyticsLoading,
  analyticsError,
  streaksData,
  completionData,
}: ModernAnalyticsDashboardProps) {
  // Cross-slice event integration
  const { emitAnalyticsRefreshNeeded, emitAnalyticsDataUpdated } =
    useEventEmitters();

  // Listen to analytics events from other components
  useAnalyticsEvents((eventType, payload) => {
    event(`ModernAnalyticsDashboard: Received ${eventType} event:`, payload);

    // Handle analytics events from other components
    switch (eventType) {
      case 'ANALYTICS_REFRESH_NEEDED':
        analytics(
          'ModernAnalyticsDashboard: Refreshing due to external trigger',
        );
        onRefresh();
        break;
      case 'ANALYTICS_DATA_UPDATED':
        analytics('ModernAnalyticsDashboard: Data updated externally');
        // The parent component will handle the data update
        break;
    }
  });

  const metrics = [
    {
      title: 'Total Habits',
      value: summaryData?.total_habits || 0,
      subtitle: 'Habits created',
      icon: Target,
      color: 'text-blue-600',
    },
    {
      title: 'Active Habits',
      value: summaryData?.active_habits || 0,
      subtitle: 'Currently tracking',
      icon: Activity,
      color: 'text-green-600',
    },
    {
      title: 'Total Tasks',
      value: summaryData?.total_tasks || 0,
      subtitle: 'Tasks created',
      icon: Target,
      color: 'text-indigo-600',
    },
    {
      title: 'Active Tasks',
      value: summaryData?.active_tasks || 0,
      subtitle: 'Pending tasks',
      icon: Activity,
      color: 'text-cyan-600',
    },
    {
      title: 'Completion Rate',
      value: `${summaryData?.average_completion_rate?.toFixed(1) || '0'}%`,
      subtitle: 'Average performance',
      icon: CheckCircle2,
      color: 'text-purple-600',
    },
    {
      title: 'Current Streaks',
      value: summaryData?.total_current_streaks || 0,
      subtitle: 'Active streaks',
      icon: Zap,
      color: 'text-orange-600',
    },
    {
      title: 'Best Streak',
      value: summaryData?.longest_overall_streak || 0,
      subtitle: 'Personal record',
      icon: Award,
      color: 'text-yellow-600',
    },
    {
      title: 'Most Consistent',
      value: summaryData?.most_consistent_habit_name || 'None',
      subtitle: 'Top performing habit',
      icon: BarChart3,
      color: 'text-pink-600',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-slate-600 text-sm sm:text-base">
            Track your progress and performance insights
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <Select value={selectedPeriod} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-200">
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                console.log(
                  '🔗 ModernAnalyticsDashboard: Manual refresh triggered',
                );
                emitAnalyticsRefreshNeeded({
                  userId: 'current',
                  trigger: 'manual',
                  timestamp: new Date(),
                });
                onRefresh();
              }}
              disabled={analyticsLoading}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none bg-transparent"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={onExport}
              disabled={analyticsLoading}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none bg-transparent"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {analyticsError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100">
                <Activity className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-800">
                  Error Loading Analytics
                </h3>
                <p className="text-red-600">{analyticsError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {metrics.map((metric, index) => (
          <Card
            key={metric.title}
            className="bg-white shadow-lg border border-slate-200"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-600">
                    {metric.title}
                  </p>
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-slate-900">
                      {analyticsLoading ? (
                        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
                      ) : (
                        metric.value
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{metric.subtitle}</p>
                  </div>
                </div>
                <div className={`p-3 rounded-lg bg-slate-100 ${metric.color}`}>
                  <metric.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Streak Chart */}
        <div className="min-w-0">
          <StreakChart data={streaksData} isLoading={analyticsLoading} />
        </div>

        {/* Completion Rate Chart */}
        <div className="min-w-0">
          <CompletionRateChart
            data={completionData}
            isLoading={analyticsLoading}
          />
        </div>
      </div>
    </div>
  );
}
