import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@ufc-intelligence/database";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        // Whatever we return here becomes available in the JWT/session.
        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? undefined,
          role: user.role,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    // Runs when the JWT is created/updated — this is how role/id/username
    // survive into the session, since by default only email/name are
    // included.
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.username = (user as any).username;
      }
      // The JWT strategy doesn't re-read the DB on its own - a username
      // changed via PATCH /api/account would otherwise stay stale in the
      // session until the next full sign-in. The account-settings page
      // calls the client-side session.update() after a successful save,
      // which sets trigger to "update" and lands here.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { username: true, displayName: true },
        });
        if (fresh) {
          token.username = fresh.username;
          token.name = fresh.displayName ?? undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
      }
      return session;
    },
  },
});