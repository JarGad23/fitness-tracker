import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare, getRounds, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// bcryptjs is pure JS: cost 12 took ~190 ms per login on an M5 Max, more on Vercel's
// slower CPUs. 10 is 4x cheaper (~70 ms) and still OWASP's minimum for bcrypt. Older cost-12
// hashes are rewritten on the next successful login.
export const BCRYPT_ROUNDS = 10;

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Auth.js only auto-trusts the host in dev. Under `next start` / self-hosting
  // it must be set explicitly, otherwise it throws UntrustedHost.
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Hasło", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (!user) {
          return null;
        }

        const isValid = await compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        if (getRounds(user.passwordHash) !== BCRYPT_ROUNDS) {
          await db
            .update(users)
            .set({ passwordHash: await hash(password, BCRYPT_ROUNDS) })
            .where(eq(users.id, user.id));
        }

        return {
          id: user.id,
          email: user.email,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
