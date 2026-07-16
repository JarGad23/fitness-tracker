import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

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
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("health_metrics_user_date_unique").on(table.userId, table.date),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  activityTypes: many(activityTypes),
  workouts: many(workouts),
  healthMetrics: many(healthMetrics),
}));

export const activityTypesRelations = relations(activityTypes, ({ one, many }) => ({
  user: one(users, {
    fields: [activityTypes.userId],
    references: [users.id],
  }),
  workouts: many(workouts),
}));

export const workoutsRelations = relations(workouts, ({ one }) => ({
  user: one(users, {
    fields: [workouts.userId],
    references: [users.id],
  }),
  activityType: one(activityTypes, {
    fields: [workouts.activityTypeId],
    references: [activityTypes.id],
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
