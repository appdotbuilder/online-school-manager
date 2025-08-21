import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput, type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '7d';

// Simple password hashing using Node.js crypto
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const [salt, hash] = hashedPassword.split(':');
  if (!salt || !hash) return false;
  
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Simple JWT implementation using crypto
function createJWT(payload: object): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (7 * 24 * 60 * 60); // 7 days
  
  const jwtPayload = { ...payload, iat: now, exp };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// In-memory store for password reset tokens (in production, use Redis or database)
const resetTokenStore = new Map<string, { email: string; expires: Date }>();

export async function register(input: RegisterInput): Promise<User> {
  try {
    // Check if email already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role,
        avatar_url: null,
        is_active: true,
        email_verified: false
      })
      .returning()
      .execute();

    const user = result[0];
    return {
      ...user,
      created_at: new Date(user.created_at),
      updated_at: new Date(user.updated_at)
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
}

export async function login(input: LoginInput): Promise<{ user: User; token: string }> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = createJWT({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return {
      user: {
        ...user,
        created_at: new Date(user.created_at),
        updated_at: new Date(user.updated_at)
      },
      token
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
}

export async function logout(userId: number): Promise<{ success: boolean }> {
  try {
    // In a real implementation, you might:
    // 1. Add the token to a blacklist in Redis/database
    // 2. Update a last_logout timestamp in the user table
    // 3. Invalidate any active sessions
    
    // For now, we'll just return success since JWT tokens are stateless
    // The client should remove the token from storage
    return { success: true };
  } catch (error) {
    console.error('User logout failed:', error);
    throw error;
  }
}

export async function forgotPassword(email: string): Promise<{ success: boolean }> {
  try {
    // Check if user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .execute();

    if (users.length === 0) {
      // Don't reveal whether email exists or not for security
      return { success: true };
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      return { success: true };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store token (in production, use Redis or database)
    resetTokenStore.set(resetToken, { email, expires });

    // In a real implementation, you would send an email here
    console.log(`Password reset token for ${email}: ${resetToken}`);

    return { success: true };
  } catch (error) {
    console.error('Forgot password failed:', error);
    throw error;
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
  try {
    // Validate token
    const tokenData = resetTokenStore.get(token);
    if (!tokenData) {
      throw new Error('Invalid or expired reset token');
    }

    if (new Date() > tokenData.expires) {
      resetTokenStore.delete(token);
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    const result = await db.update(usersTable)
      .set({
        password_hash: passwordHash,
        updated_at: new Date()
      })
      .where(eq(usersTable.email, tokenData.email))
      .execute();

    // Remove used token
    resetTokenStore.delete(token);

    return { success: true };
  } catch (error) {
    console.error('Password reset failed:', error);
    throw error;
  }
}

// Export the reset token store for testing
export { resetTokenStore };