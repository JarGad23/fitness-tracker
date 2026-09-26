import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const activityTypes = sqliteTable("activity_types", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetPerWeek: integer("target_per_week").notNull(),
  icon: text("icon").notNull(),
  color: text("color"), // hex, e.g. "#22c55e"
  // Which Apple Watch signal auto-logs this activity: "cycling" | "swimming" |
  // "running". "strength" (gym) = logs sets and gets a confirm prompt from
  // exercise minutes instead of an auto-created workout. Null = manual only.
  healthKind: text("health_kind"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const workouts = sqliteTable("workouts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  activityTypeId: text("activity_type_id")
    .notNull()
    .references(() => activityTypes.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // ISO date string "2026-06-01"
  notes: text("notes"),
  duration: text("duration"), // optional range code e.g. "45-60"
  feelingScore: integer("feeling_score"), // optional 1-5 self-rating
  // "manual" (logged in the app) | "watch" (auto-created from Apple Health data)
  source: text("source").notNull().default("manual"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Apple Watch / Apple Health metrics, ingested via the /api/watch-sync webhook.
// One row per user per day: Shortcuts may re-send the same day, so the webhook
// upserts on the (user_id, date) unique index below.
export const healthMetrics = sqliteTable(
  "health_metrics",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // ISO date string "2026-06-01"
    activeCalories: integer("active_calories"),
    restingHr: integer("resting_hr"),
    sleepHours: real("sleep_hours"),
    exerciseMinutes: integer("exercise_minutes"),
    // Workout-only signals: the watch records these only during a workout, so a
    // value on a day means that workout happened (see src/lib/health-sync.ts).
    cyclingKm: real("cycling_km"),
    swimmingM: integer("swimming_m"),
    runningSpeedKmh: real("running_speed_kmh"),
    // User answered "no" to "was this the gym?" for this day — don't ask again.
    gymPromptDismissed: integer("gym_prompt_dismissed", { mode: "boolean" })
      .notNull()
      .default(false),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("health_metrics_user_date_unique").on(table.userId, table.date),
  ]
);

// Gym exercise catalog, per user. Created on the fly from the workout page.
// Names are unique per user ignoring case (the index is on lower(name)).
export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("exercises_user_name_unique").on(table.userId, sql`lower(${table.name})`),
  ]
);

// One row per set. Exercise order within a workout = min(position) of its sets.
export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: text("id").primaryKey(),
    workoutId: text("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    reps: integer("reps").notNull(),
    weightKg: real("weight_kg"), // null = bodyweight
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("workout_sets_workout_idx").on(table.workoutId),
    index("workout_sets_exercise_idx").on(table.exerciseId),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  activityTypes: many(activityTypes),
  workouts: many(workouts),
  healthMetrics: many(healthMetrics),
  exercises: many(exercises),
}));

export const activityTypesRelations = relations(activityTypes, ({ one, many }) => ({
  user: one(users, {
    fields: [activityTypes.userId],
    references: [users.id],
  }),
  workouts: many(workouts),
}));

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  user: one(users, {
    fields: [workouts.userId],
    references: [users.id],
  }),
  activityType: one(activityTypes, {
    fields: [workouts.activityTypeId],
    references: [activityTypes.id],
  }),
  sets: many(workoutSets),
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  user: one(users, { fields: [exercises.userId], references: [users.id] }),
  sets: many(workoutSets),
}));

export const workoutSetsRelations = relations(workoutSets, ({ one }) => ({
  workout: one(workouts, {
    fields: [workoutSets.workoutId],
    references: [workouts.id],
  }),
  exercise: one(exercises, {
    fields: [workoutSets.exerciseId],
    references: [exercises.id],
  }),
}));

export const healthMetricsRelations = relations(healthMetrics, ({ one }) => ({
  user: one(users, {
    fields: [healthMetrics.userId],
    references: [users.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ActivityType = typeof activityTypes.$inferSelect;
export type NewActivityType = typeof activityTypes.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type HealthMetric = typeof healthMetrics.$inferSelect;
export type NewHealthMetric = typeof healthMetrics.$inferInsert;
export type Exercise = typeof exercises.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
