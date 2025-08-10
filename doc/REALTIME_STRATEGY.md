# Real-Time Strategy Document - Phase 7

## 📋 Overview

This document establishes the conventions, patterns, and implementation strategy for real-time features in the Task & Habit Tracker application.

## 🏗️ Architecture Principles

### 1. **Separation of Concerns**

- **Real-time Client**: Handles Supabase connections and subscriptions
- **Event Manager**: Orchestrates cross-component communication
- **UI Components**: React to events and update state
- **Toast System**: Provides user feedback

### 2. **Incremental Implementation**

- Each feature builds on the previous
- Test each step before proceeding
- Maintain backward compatibility

### 3. **Error Resilience**

- Graceful degradation when real-time fails
- Automatic reconnection strategies
- User-friendly error messages

## 🔌 Channel Naming Conventions

### **Table-Based Channels**

```
{table_name}_changes
```

**Examples:**

- `tasks_changes` - For task CRUD operations
- `habits_changes` - For habit CRUD operations
- `habit_events_changes` - For habit completion events

### **Event Types**

- `INSERT` - New records created
- `UPDATE` - Records modified
- `DELETE` - Records deleted (soft delete)

## 📡 Subscription Lifecycle

### **1. Connection Setup**

```typescript
// Initialize connection
const channel = supabase
  .channel('channel_name')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'table_name' },
    callback,
  )
  .subscribe();
```

### **2. Event Handling**

```typescript
// Handle events
const handleEvent = (payload: RealtimePostgresChangesPayload) => {
  // 1. Validate payload
  // 2. Update local state
  // 3. Trigger UI updates
  // 4. Show toast notification
};
```

### **3. Cleanup**

```typescript
// Cleanup on unmount
useEffect(() => {
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## 🔄 Reconnection Strategy

### **Automatic Reconnection**

- **Initial Delay**: 1 second
- **Max Attempts**: 5
- **Backoff Multiplier**: 2x
- **Max Delay**: 30 seconds

### **Connection States**

```typescript
type ConnectionState = {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempts: number;
};
```

### **User Feedback**

- Show connection status in UI
- Display reconnection progress
- Notify when connection restored

## 🎯 Event Flow Patterns

### **1. Task Events**

```
Task Created → Update Task List → Show Success Toast
Task Updated → Update Task List → Show Info Toast
Task Deleted → Remove from List → Show Info Toast
```

### **2. Habit Events**

```
Habit Created → Update Habit List → Show Success Toast
Habit Updated → Update Habit List → Show Info Toast
Habit Deleted → Remove from List → Show Info Toast
Habit Event → Update Analytics → Show Success Toast
```

### **3. Analytics Events**

```
Data Changed → Refresh Analytics → Update Charts
```

## 🧩 Cross-Slice Communication

### **Event Types**

```typescript
type RealtimeEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'habit_created'
  | 'habit_updated'
  | 'habit_deleted'
  | 'habit_event_created'
  | 'habit_event_updated'
  | 'habit_event_deleted'
  | 'analytics_updated'
  | 'streak_updated'
  | 'completion_rate_updated';
```

### **Event Payload Structure**

```typescript
interface RealtimeEventPayload {
  type: RealtimeEventType;
  userId: string;
  data?: any;
  timestamp: number;
}
```

### **Event Flow**

```
Database Change → Supabase Realtime → Event Manager → UI Components → Toast
```

## 🛡️ Error Handling

### **Connection Errors**

- Log error details
- Attempt automatic reconnection
- Show user-friendly message
- Fallback to polling if needed

### **Event Processing Errors**

- Validate payload structure
- Handle missing data gracefully
- Log errors for debugging
- Continue processing other events

### **UI Update Errors**

- Prevent infinite loops
- Handle state conflicts
- Maintain UI consistency
- Provide manual refresh option

## 📱 UI Fallback Patterns

### **When Real-Time Fails**

1. **Show Connection Status**: Indicate real-time is offline
2. **Enable Manual Refresh**: Provide refresh button
3. **Polling Fallback**: Periodic data fetching
4. **Optimistic Updates**: Update UI immediately, sync later

### **Loading States**

- Show loading indicators during reconnection
- Disable real-time dependent features
- Provide clear status messages

## 🧪 Testing Strategy

### **Development Testing**

- **Two Browser Tabs**: Test cross-tab synchronization
- **Console Logging**: Monitor event flow
- **Network Throttling**: Test slow connections
- **Disconnect Simulation**: Test reconnection

### **Test Scenarios**

1. **Happy Path**: Normal real-time flow
2. **Connection Loss**: Network interruption
3. **Reconnection**: Automatic recovery
4. **Error Handling**: Invalid data scenarios
5. **Performance**: Multiple rapid changes

## 📊 Performance Considerations

### **Subscription Management**

- Limit concurrent subscriptions
- Clean up unused channels
- Batch related events
- Debounce rapid updates

### **Memory Management**

- Remove event listeners on unmount
- Clear timeouts and intervals
- Prevent memory leaks
- Monitor subscription count

### **Network Optimization**

- Use efficient filters
- Minimize payload size
- Implement rate limiting
- Cache frequently accessed data

## 🔧 Implementation Checklist

### **Pre-Implementation**

- [ ] Review this strategy document
- [ ] Set up development environment
- [ ] Prepare testing scenarios
- [ ] Create error monitoring

### **During Implementation**

- [ ] Follow naming conventions
- [ ] Implement error handling
- [ ] Add comprehensive logging
- [ ] Test each step thoroughly

### **Post-Implementation**

- [ ] Performance testing
- [ ] Error scenario testing
- [ ] User experience validation
- [ ] Documentation updates

## 📚 References

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Next.js 15 App Router](https://nextjs.org/docs/app)
- [Sonner Toast Documentation](https://sonner.emilkowal.ski/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)

---

**Next Step**: Proceed to Step 1.1: Toast Shell Setup
