# Personal Task & Habit Tracker Web App Documentation

## 1. Project Charter & Statement of Work (SOW)

### Project Overview

- **Project Name**: Personal Task & Habit Tracker Web App
- **Project Duration**: 8-12 weeks (solo development)
- **Project Type**: Full-stack web application for portfolio demonstration

### Project Scope & Objectives

- **Primary Goal**: Develop a comprehensive task and habit tracking application that demonstrates full-stack development capabilities using modern technologies.

### Core Features:

- User authentication and profile management
- Task creation, editing, and organization
- Habit tracking with streak counters
- Progress visualization and analytics
- Responsive design for desktop and mobile
- Real-time updates and notifications

### Success Criteria:

- Fully functional web application deployed to production
- Clean, maintainable codebase following best practices
- Responsive design across all device sizes
- Performance score >90 on Lighthouse
- Complete documentation and README

---

## 2. Technical Design Document (TDD)

### Architecture Decision: Monolithic with Modular Structure

- **Rationale**: For a solo portfolio project, monolithic architecture provides simplicity while maintaining clear separation of concerns.

### Structure:

- Next.js full-stack application with API routes

### Technology Stack (All Free Services)

#### Frontend:

- **Next.js 15.3.5**
- **TypeScript**: Yes
- **ESLint**: No
- **Tailwind CSS**: Yes
- **Shadcn/ui**: For component library
- **Framer Motion**: For animations

#### Backend:

- **Next.js API Routes** (Node.js 24.3.0)
- **Server Actions**: For form handling
- **Middleware**: For authentication

#### Database:

- **Primary**: Supabase (PostgreSQL) - Free tier: 500MB storage, 2GB bandwidth
- **Alternative**: Neon (PostgreSQL) - Free tier: 512MB storage

#### Authentication:

- **Supabase Auth** (built-in OAuth providers)
- **JWT tokens** with secure httpOnly cookies

#### Hosting & Deployment:

- **Vercel** (Free tier: Unlimited personal projects)
- **GitHub** for version control

#### Additional Services:

- **Vercel Analytics** (Free)
- **Sentry** for error monitoring (Free tier: 5K errors/month)

---

## 3. Database Schema & Data Flow Design

### Database Choice: PostgreSQL via Supabase

- **Rationale**: ACID compliance, complex queries support, JSON support for flexible data, excellent with Next.js

### Core Tables Structure:

```sql
-- Users (handled by Supabase Auth)
users (
  id: uuid (primary key)
  email: varchar
  created_at: timestamp
  updated_at: timestamp
)

-- User Profiles
profiles (
  id: uuid (primary key, foreign key to users)
  username: varchar
  full_name: varchar
  avatar_url: text
  timezone: varchar
  created_at: timestamp
  updated_at: timestamp
)

-- Tasks
tasks (
  id: uuid (primary key)
  user_id: uuid (foreign key)
  title: varchar(255)
  description: text
  status: enum ('pending', 'in_progress', 'completed')
  priority: enum ('low', 'medium', 'high')
  due_date: timestamp
  created_at: timestamp
  updated_at: timestamp
)

-- Habits
habits (
  id: uuid (primary key)
  user_id: uuid (foreign key)
  name: varchar(255)
  description: text
  frequency: enum ('daily', 'weekly', 'monthly')
  target_count: integer
  color: varchar(7)
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
)

-- Habit Entries
habit_entries (
  id: uuid (primary key)
  habit_id: uuid (foreign key)
  date: date
  completed: boolean
  notes: text
  created_at: timestamp
)
```
