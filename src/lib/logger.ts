/**
 * Logger utility for controlling console output based on environment
 * Disables all console logs in production for security
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isLoggingEnabled = process.env.NEXT_PUBLIC_ENABLE_LOGGING === 'true';

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment && isLoggingEnabled) {
      console.log(...args);
    }
  },

  info: (...args: any[]) => {
    if (isDevelopment && isLoggingEnabled) {
      console.log('ℹ️', ...args);
    }
  },

  success: (...args: any[]) => {
    if (isDevelopment && isLoggingEnabled) {
      console.log('✅', ...args);
    }
  },

  warning: (...args: any[]) => {
    if (isDevelopment && isLoggingEnabled) {
      console.log('⚠️', ...args);
    }
  },

  error: (...args: any[]) => {
    // Always log errors for debugging, but without sensitive data
    if (isDevelopment) {
      console.error('❌', ...args);
    }
  },

  debug: (...args: any[]) => {
    if (isDevelopment && isLoggingEnabled) {
      console.log('🔍', ...args);
    }
  },

  // Special method for cross-slice events (most sensitive)
  event: (...args: any[]) => {
    if (isDevelopment && isLoggingEnabled) {
      console.log('🔗', ...args);
    }
  },

  // Special method for real-time subscriptions (very sensitive)
  realtime: (...args: any[]) => {
    if (isDevelopment && isLoggingEnabled) {
      console.log('📡', ...args);
    }
  },

  // Special method for analytics (sensitive)
  analytics: (...args: any[]) => {
    if (isDevelopment && isLoggingEnabled) {
      console.log('📊', ...args);
    }
  },
};

// Export individual methods for convenience
export const {
  log,
  info,
  success,
  warning,
  error,
  debug,
  event,
  realtime,
  analytics,
} = logger;
