import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { getSessionUserId } from "./session";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function registerUser(args: {
  email: string;
  name: string;
  password: string;
}) {
  const email = args.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with that email already exists");
  return prisma.user.create({
    data: {
      email,
      name: args.name.trim(),
      passwordHash: await hashPassword(args.password),
    },
  });
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

/** Load the current user (server-side). Returns null when signed out. */
export async function getCurrentUser() {
  const id = getSessionUserId();
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}
