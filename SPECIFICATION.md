# Product Requirements Document (PRD): Flexible Fitness Tracker

## 1. Project Overview & Intent

The goal is to build a lightweight, mobile-first web application for tracking weekly fitness goals. Instead of assigning workouts to specific days of the week, the user works with a "Weekly Pool of Activities" (Backlog). The user can freely log any activity on any day, aiming to "clear" the predefined weekly targets.

### The Weekly Targets:

- **Gym (Siłownia):** 4 sessions / week (~60 min each)
- **Running (Bieganie):** 3 sessions / week (~30 min each)
- **Cycling (Rower):** 3 sessions / week (~60 min each)
- **Pool & Sauna (Basen/Sauna):** 2 sessions / week (Active recovery)

Total: 12 activities per week.

---

## 2. Tech Stack Recommendations

_To be validated by Claude Code based on the repository environment:_

- **Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui (for fast, clean components).
- **Database/Backend:** Supabase (PostgreSQL) or Prisma with local SQLite for MVP.
- **State Management:** React Context or simple server actions.

---

## 3. Core Features & User Stories

### Feature 1: The Flexible Weekly Dashboard (Main View)

- **User Story:** As a user, when I open the app, I want to see my current week's progress at a glance without feeling forced into a rigid daily schedule.
- **UI Components:**
  - **Current Week Selector:** Ability to browse current and previous weeks.
  - **The Progress Grid:** A list of the 4 activity types, each showing a visual progress bar or counter (e.g., "Running: 1 / 3 done").
  - **The Quick-Log Section:** A simple grid of 7 days (Monday - Sunday). Clicking on a day opens a quick-add modal/menu to log one of the activities for that specific day.

### Feature 2: Historical Log

- **User Story:** As a user, I want to see a history of what I achieved in past weeks to track my consistency over time.

### Feature 3: Auto-Reset Mechanism

- **User Story:** Every Monday at 00:00, the weekly pool should reset (or rather, a new tracking week should be instantiated), giving me a fresh start.

---

## 4. Database Schema (PostgreSQL / Prisma Dialect)

The system requires tracking weekly goals dynamically, allowing the user to modify targets in the future, while maintaining a strict log of executed activities.

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  workouts  Workout[]
}

model ActivityType {
  id            String   @id @default(uuid())
  name          String   // e.g., "Siłownia", "Bieganie", "Rower", "Basen"
  defaultTarget Int      // e.g., 4, 3, 3, 2
  icon          String   // Lucide icon name string
  workouts      Workout[]
}

model Workout {
  id             String       @id @default(uuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  activityTypeId String
  activityType   ActivityType @relation(fields: [activityTypeId], references: [id])
  date           DateTime     // The specific day the workout was done
  createdAt      DateTime     @default(now())
  notes          String?      // Optional notes (e.g., "Leg day", "Rainy run")
}
```

## 5. UI/UX Wireframe Concept (Tailwind-based layout)

+-------------------------------------------------------+
| [<] Week 23 (Jun 01 - Jun 07, 2026) [>] |
+-------------------------------------------------------+
| WEEKLY POOL PROGRESS |
| - Siłownia: [██████████░░░░░░] 2 / 4 |
| - Bieganie: [████████████████] 3 / 3 (COMPLETED! 🎉)|
| - Rower: [░░░░░░░░░░░░░░░░] 0 / 3 |
| - Basen: [████████░░░░░░░░] 1 / 2 |
+-------------------------------------------------------+
| WEEKLY LOG (Click Day to Add) |
| [Mon] -> Siłownia |
| [Tue] -> Bieganie, Basen |
| [Wed] -> [ + Add Activity ] |
| [Thu] -> Bieganie |
| [Fri] -> Siłownia |
| [Sat] -> Bieganie |
| [Sun] -> [ + Add Activity ] |
+-------------------------------------------------------+

## 6. Implementation Steps for Claude Code (/plan mode)

Step 1: Setup & Seeding: Initialize the database schema and seed the 4 baseline activity types with their corresponding weekly targets (Gym: 4, Run: 3, Bike: 3, Pool: 2).

Step 2: Core API / Server Actions: Create functions to:

Fetch workouts for a given date range (start of week to end of week).

Log an activity for a specific date.

Delete/Undo a logged activity.

Step 3: Frontend Dashboard: Build the main view showing the aggregate progress of the current week alongside the daily logger.

Step 4: Enhancements: Add animations on completing a weekly goal (e.g., green checkmarks, smooth progress transitions) and implement the week switcher.

Step 5: Historical View: Create a separate page or section to view past weeks' logs and progress.
