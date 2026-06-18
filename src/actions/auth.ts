"use server";

import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users, activityTypes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { signIn, signOut } from "@/lib/auth";
import { updateTag } from "next/cache";
import { v4 as uuid } from "uuid";
import { AuthError } from "next-auth";

const DEFAULT_ACTIVITIES = [
  { name: "Siłownia", targetPerWeek: 4, icon: "Dumbbell", sortOrder: 0, color: "#eab308" },
  { name: "Bieganie", targetPerWeek: 3, icon: "PersonStanding", sortOrder: 1, color: "#f97316" },
  { name: "Rower", targetPerWeek: 3, icon: "Bike", sortOrder: 2, color: "#22c55e" },
  { name: "Basen", targetPerWeek: 2, icon: "Waves", sortOrder: 3, color: "#3b82f6" },
];

export async function register(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!email || !password) {
    return { error: "Email i hasło są wymagane" };
  }

  if (password !== confirmPassword) {
    return { error: "Hasła nie są takie same" };
  }

  if (password.length < 6) {
    return { error: "Hasło musi mieć minimum 6 znaków" };
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return { error: "Użytkownik o tym emailu już istnieje" };
  }

  const passwordHash = await hash(password, 12);
  const userId = uuid();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
  });

  // Seed default activity types for new user
  await db.insert(activityTypes).values(
    DEFAULT_ACTIVITIES.map((activity) => ({
      id: uuid(),
      userId,
      ...activity,
    }))
  );

  return { ok: true };
}

export async function login(formData: FormData) {
  try {
    // redirect: false — only set the session cookie here. The client navigates
    // explicitly afterwards, so the redirect can't get swallowed by the wrapping
    // client action (which left the form frozen with the cookie already set).
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Nieprawidłowy email lub hasło" };
        default:
          return { error: "Wystąpił błąd podczas logowania" };
      }
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirect: false });
  updateTag("workouts");
  updateTag("activity-types");
}
