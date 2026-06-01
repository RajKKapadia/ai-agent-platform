import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { users, type User, type UserRole } from "./schema";

const passwordAlgorithm = "scrypt";
const passwordKeyLength = 64;
const passwordSaltLength = 16;
const scrypt = promisify(scryptCallback);

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

export class DuplicateUserError extends Error {
  constructor(email: string) {
    super(`A user already exists for ${email}`);
    this.name = "DuplicateUserError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(passwordSaltLength);
  const derivedKey = (await scrypt(
    password,
    salt,
    passwordKeyLength,
  )) as Buffer;

  return [
    passwordAlgorithm,
    passwordKeyLength,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join(":");
}

async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const [algorithm, keyLengthValue, saltValue, hashValue] =
    passwordHash.split(":");

  if (
    algorithm !== passwordAlgorithm ||
    !keyLengthValue ||
    !saltValue ||
    !hashValue
  ) {
    return false;
  }

  const keyLength = Number.parseInt(keyLengthValue, 10);

  if (!Number.isInteger(keyLength) || keyLength <= 0) {
    return false;
  }

  const salt = Buffer.from(saltValue, "base64url");
  const expectedHash = Buffer.from(hashValue, "base64url");
  const actualHash = (await scrypt(password, salt, keyLength)) as Buffer;

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedHash);
}

export async function getUserByEmail(email: string): Promise<PublicUser | null> {
  const normalizedEmail = normalizeEmail(email);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail));

  return user ? toPublicUser(user) : null;
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ? toPublicUser(user) : null;
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const email = normalizeEmail(input.email);
  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    throw new DuplicateUserError(email);
  }

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      name: input.name.trim(),
      email,
      passwordHash,
    })
    .returning();

  if (!user) {
    throw new Error("Failed to create user");
  }

  return toPublicUser(user);
}

export async function verifyUserPassword(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const normalizedEmail = normalizeEmail(email);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail));

  if (!user) {
    return null;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  return passwordMatches ? toPublicUser(user) : null;
}
