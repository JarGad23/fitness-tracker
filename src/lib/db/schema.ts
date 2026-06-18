import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  activityTypes: many(activityTypes),
  workouts: many(workouts),
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

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ActivityType = typeof activityTypes.$inferSelect;
export type NewActivityType = typeof activityTypes.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
