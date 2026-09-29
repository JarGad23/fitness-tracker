"use server";

import { db } from "@/lib/db";
import { dayNotes } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { updateTag } from "next/cache";
import { DAY_NOTE_MAX_LENGTH, DAY_TAGS, type DayNoteValue } from "@/lib/day-notes";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Nie jesteś zalogowany");
  return session.user.id;
}

function requireDate(date: string) {
  if (!DATE_RE.test(date)) throw new Error("Nieprawidłowa data");
}

/** For dates outside what the page loaded (e.g. picked in the modal's date picker). */
export async function loadDayNote(date: string): Promise<DayNoteValue | null> {
  const userId = await requireUserId();
  requireDate(date);
  const note = await db.query.dayNotes.findFirst({
    where: and(eq(dayNotes.userId, userId), eq(dayNotes.date, date)),
  });
  return note ? { tags: note.tags, text: note.text } : null;
}

/** Saves the whole note for a day; no tags and no text deletes it. */
export async function saveDayNote(date: string, tags: string[], text: string) {
  const userId = await requireUserId();
  requireDate(date);

  // Known keys only, in list order (stable for the AI export, not in tap order).
  const cleanTags: string[] = DAY_TAGS.map((t) => t.key).filter((key) => tags.includes(key));
  const cleanText = text.trim().slice(0, DAY_NOTE_MAX_LENGTH) || null;

  if (cleanTags.length === 0 && !cleanText) {
    await db
      .delete(dayNotes)
      .where(and(eq(dayNotes.userId, userId), eq(dayNotes.date, date)));
  } else {
    await db
      .insert(dayNotes)
      .values({ id: uuid(), userId, date, tags: cleanTags, text: cleanText })
      .onConflictDoUpdate({
        target: [dayNotes.userId, dayNotes.date],
        set: { tags: cleanTags, text: cleanText, updatedAt: new Date() },
      });
  }

  updateTag("day-notes");
}
