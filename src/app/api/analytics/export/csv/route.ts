import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type {
  StreakData,
  CompletionRateData,
  AnalyticsSummary,
} from '@/types/analytics';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // all, streaks, completion-rates, summary
    const period =
      (searchParams.get('period') as 'week' | 'month' | 'year') || 'month'; // Ensuring period type is strictly one of these

    let csvData = '';
    let filename = '';

    if (type === 'all' || type === 'streaks') {
      // Get streak data
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null);

      if (habitsError) {
        console.error('Error fetching habits for streaks:', habitsError);
        return NextResponse.json(
          { error: 'Failed to fetch habits data' },
          { status: 500 },
        );
      }

      if (habits) {
        const streaksData: StreakData[] = [];

        for (const habit of habits) {
          const { data: streakResult, error: streakError } = await supabase.rpc(
            'get_habit_streak',
            {
              habit_id: habit.id,
            },
          );

          if (streakError) {
            console.error(
              `Error getting streak for habit ${habit.id}:`,
              streakError,
            );
            continue;
          }

          if (streakResult) {
            // Handle array format from RPC
            const streakData = Array.isArray(streakResult)
              ? streakResult[0]
              : streakResult;
            if (streakData) {
              streaksData.push({
                habit_id: habit.id,
                habit_name: habit.name,
                current_streak: streakData.current_streak || 0,
                longest_streak: streakData.longest_streak || 0,
                total_completions: streakData.total_completions || 0,
                last_completion_date: streakData.last_completion_date,
                streak_start_date: streakData.streak_start_date,
              });
            }
          }
        }

        // Generate CSV for streaks
        const streaksCsv = generateStreaksCSV(streaksData);
        csvData += streaksCsv + '\n\n';
        filename = 'habits-streaks';
      }
    }

    if (type === 'all' || type === 'completion-rates') {
      // Get completion rate data
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null);

      if (habitsError) {
        console.error(
          'Error fetching habits for completion rates:',
          habitsError,
        );
        return NextResponse.json(
          { error: 'Failed to fetch habits data' },
          { status: 500 },
        );
      }

      if (habits) {
        const completionData: CompletionRateData[] = [];

        for (const habit of habits) {
          const { data: completionResult, error: completionError } =
            await supabase.rpc('get_completion_rate', {
              habit_id: habit.id,
              period_start: getPeriodStartDate(period),
              period_end: new Date().toISOString().split('T')[0],
            });

          if (completionError) {
            console.error(
              `Error getting completion rate for habit ${habit.id}:`,
              completionError,
            );
            continue;
          }

          if (completionResult) {
            // Handle array format from RPC
            const completionDataItem = Array.isArray(completionResult)
              ? completionResult[0]
              : completionResult;
            if (completionDataItem) {
              completionData.push({
                habit_id: habit.id,
                habit_name: habit.name,
                completion_rate: completionDataItem.completion_rate || 0,
                completed_days: completionDataItem.completed_days || 0,
                total_days: completionDataItem.total_days || 0,
                period: period,
                period_start: getPeriodStartDate(period), // Add period_start
                period_end: new Date().toISOString().split('T')[0], // Add period_end
              });
            }
          }
        }

        // Generate CSV for completion rates
        const completionCsv = generateCompletionRatesCSV(
          completionData,
          period,
        );
        csvData += completionCsv + '\n\n';
        filename = filename
          ? `${filename}-completion-rates`
          : 'completion-rates';
      }
    }

    if (type === 'all' || type === 'summary') {
      // Get summary data
      const { data: summaryResult, error: summaryError } = await supabase.rpc(
        'get_analytics_summary',
        {
          user_id: user.id,
        },
      );

      if (summaryError) {
        console.error('Error fetching summary data:', summaryError);
        return NextResponse.json(
          { error: 'Failed to fetch summary data' },
          { status: 500 },
        );
      }

      if (summaryResult) {
        // Summary data received - logging removed for security
        // Generate CSV for summary - handle array format from RPC
        const summaryData = Array.isArray(summaryResult)
          ? summaryResult[0]
          : summaryResult;
        const summaryCsv = generateSummaryCSV(summaryData);
        csvData += summaryCsv;
        filename = filename ? `${filename}-summary` : 'analytics-summary';
      }
    }

    // Set response headers for CSV download
    const response = new NextResponse(csvData);
    response.headers.set('Content-Type', 'text/csv');
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="${filename}-${new Date().toISOString().split('T')[0]}.csv"`,
    );

    return response;
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 },
    );
  }
}

function generateStreaksCSV(streaksData: StreakData[]): string {
  const headers = [
    'Habit Name',
    'Current Streak (days)',
    'Longest Streak (days)',
    'Total Completions',
    'Last Completion Date',
    'Streak Start Date',
  ];

  const rows = streaksData.map((streak) => [
    streak.habit_name,
    streak.current_streak,
    streak.longest_streak,
    streak.total_completions,
    streak.last_completion_date || 'Never',
    streak.streak_start_date || 'N/A',
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');
}

function generateCompletionRatesCSV(
  completionData: CompletionRateData[],
  period: string,
): string {
  const headers = [
    'Habit Name',
    'Completion Rate (%)',
    'Completed Days',
    'Total Days',
    'Period',
  ];

  const rows = completionData.map((data) => [
    data.habit_name,
    data.completion_rate.toFixed(1),
    data.completed_days,
    data.total_days,
    period,
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');
}

function generateSummaryCSV(summaryData: AnalyticsSummary): string {
  const headers = ['Metric', 'Value'];

  const rows = [
    ['Total Habits', summaryData.total_habits || 0],
    ['Active Habits', summaryData.active_habits || 0],
    [
      'Average Completion Rate (%)',
      (summaryData.average_completion_rate || 0).toFixed(1),
    ],
    ['Total Current Streaks', summaryData.total_current_streaks || 0],
    ['Longest Overall Streak', summaryData.longest_overall_streak || 0],
    ['Most Consistent Habit', summaryData.most_consistent_habit_name || 'N/A'],
    [
      'Most Consistent Habit Completion Rate (%)',
      summaryData.most_consistent_habit_rate
        ? summaryData.most_consistent_habit_rate.toFixed(1)
        : 'N/A',
    ],
  ];

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');
}

function getPeriodStartDate(period: 'week' | 'month' | 'year'): string {
  const today = new Date();

  switch (period) {
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
      return weekStart.toISOString().split('T')[0];
    case 'month':
      return new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];
    case 'year':
      return new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    default:
      return new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];
  }
}
