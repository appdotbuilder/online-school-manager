import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput, type LoginInput } from '../schema';
import { register, login, logout, forgotPassword, resetPassword, resetTokenStore } from '../handlers/auth';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Helper function to verify password (same logic as in handler)
function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  if (!salt || !hash) return false;
  
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Test inputs
const testRegisterInput: RegisterInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'student'
};

const testLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

const testInstructorInput: RegisterInput = {
  email: 'instructor@example.com',
  password: 'instructor123',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'instructor'
};

describe('Auth Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await register(testRegisterInput);

      expect(result.email).toBe('test@example.com');
      expect(result.first_name).toBe('John');
      expect(result.last_name).toBe('Doe');
      expect(result.role).toBe('student');
      expect(result.avatar_url).toBeNull();
      expect(result.is_active).toBe(true);
      expect(result.email_verified).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.password_hash).toBeDefined();
    });

    it('should save user to database with hashed password', async () => {
      const result = await register(testRegisterInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      const user = users[0];
      
      expect(user.email).toBe('test@example.com');
      expect(user.first_name).toBe('John');
      expect(user.last_name).toBe('Doe');
      expect(user.role).toBe('student');
      expect(user.password_hash).not.toBe('password123'); // Password should be hashed
      
      // Verify password hash is valid
      const isValidHash = verifyPassword('password123', user.password_hash);
      expect(isValidHash).toBe(true);
    });

    it('should register users with different roles', async () => {
      const studentResult = await register(testRegisterInput);
      const instructorResult = await register(testInstructorInput);

      expect(studentResult.role).toBe('student');
      expect(instructorResult.role).toBe('instructor');
    });

    it('should reject duplicate email registration', async () => {
      await register(testRegisterInput);

      await expect(register(testRegisterInput)).rejects.toThrow(/email already registered/i);
    });

    it('should allow different users with different emails', async () => {
      await register(testRegisterInput);

      const differentEmailInput = {
        ...testRegisterInput,
        email: 'different@example.com'
      };

      const result = await register(differentEmailInput);
      expect(result.email).toBe('different@example.com');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await register(testRegisterInput);
    });

    it('should login successfully with valid credentials', async () => {
      const result = await login(testLoginInput);

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.first_name).toBe('John');
      expect(result.user.last_name).toBe('Doe');
      expect(result.user.role).toBe('student');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
      
      // Verify token format (JWT has 3 parts separated by dots)
      const tokenParts = result.token.split('.');
      expect(tokenParts).toHaveLength(3);
    });

    it('should reject login with invalid email', async () => {
      const invalidEmailInput = {
        ...testLoginInput,
        email: 'nonexistent@example.com'
      };

      await expect(login(invalidEmailInput)).rejects.toThrow(/invalid credentials/i);
    });

    it('should reject login with invalid password', async () => {
      const invalidPasswordInput = {
        ...testLoginInput,
        password: 'wrongpassword'
      };

      await expect(login(invalidPasswordInput)).rejects.toThrow(/invalid credentials/i);
    });

    it('should reject login for inactive user', async () => {
      // Deactivate the user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.email, testRegisterInput.email))
        .execute();

      await expect(login(testLoginInput)).rejects.toThrow(/account is deactivated/i);
    });

    it('should allow login for different user roles', async () => {
      await register(testInstructorInput);

      const instructorLoginInput = {
        email: 'instructor@example.com',
        password: 'instructor123'
      };

      const result = await login(instructorLoginInput);
      expect(result.user.role).toBe('instructor');
      expect(result.token).toBeDefined();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const result = await logout(1);
      expect(result.success).toBe(true);
    });

    it('should logout with different user IDs', async () => {
      const result1 = await logout(1);
      const result2 = await logout(999);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('forgotPassword', () => {
    beforeEach(async () => {
      await register(testRegisterInput);
      // Clear any existing tokens
      resetTokenStore.clear();
    });

    it('should handle forgot password for existing user', async () => {
      const result = await forgotPassword('test@example.com');
      expect(result.success).toBe(true);
      
      // Verify token was created
      expect(resetTokenStore.size).toBe(1);
    });

    it('should handle forgot password for non-existent user', async () => {
      const result = await forgotPassword('nonexistent@example.com');
      expect(result.success).toBe(true); // Should not reveal if email exists
      
      // Verify no token was created
      expect(resetTokenStore.size).toBe(0);
    });

    it('should handle forgot password for inactive user', async () => {
      // Deactivate the user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.email, testRegisterInput.email))
        .execute();

      const result = await forgotPassword('test@example.com');
      expect(result.success).toBe(true); // Should not reveal if user is inactive
      
      // Verify no token was created
      expect(resetTokenStore.size).toBe(0);
    });
  });

  describe('resetPassword', () => {
    let resetToken: string;

    beforeEach(async () => {
      await register(testRegisterInput);
      resetTokenStore.clear();
      await forgotPassword('test@example.com');
      
      // Get the token from the store
      for (const [token, data] of resetTokenStore.entries()) {
        if (data.email === 'test@example.com') {
          resetToken = token;
          break;
        }
      }
    });

    it('should reset password with valid token', async () => {
      const newPassword = 'newpassword123';
      const result = await resetPassword(resetToken, newPassword);
      
      expect(result.success).toBe(true);

      // Verify user can login with new password
      const loginResult = await login({
        email: 'test@example.com',
        password: newPassword
      });
      expect(loginResult.user.email).toBe('test@example.com');
    });

    it('should reject reset with invalid token', async () => {
      const invalidToken = 'invalid-token';
      
      await expect(resetPassword(invalidToken, 'newpassword123')).rejects.toThrow(/invalid or expired/i);
    });

    it('should reject reset with expired token', async () => {
      // Manually expire the token by setting past date
      const expiredDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      resetTokenStore.set(resetToken, { email: 'test@example.com', expires: expiredDate });

      await expect(resetPassword(resetToken, 'newpassword123')).rejects.toThrow(/invalid or expired/i);
    });

    it('should update password hash in database', async () => {
      const newPassword = 'newpassword456';
      await resetPassword(resetToken, newPassword);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.email, 'test@example.com'))
        .execute();

      expect(users).toHaveLength(1);
      const user = users[0];

      // Verify new password hash is different and valid
      const isValidHash = verifyPassword(newPassword, user.password_hash);
      expect(isValidHash).toBe(true);

      // Verify old password no longer works
      const isOldPasswordValid = verifyPassword('password123', user.password_hash);
      expect(isOldPasswordValid).toBe(false);
    });

    it('should remove token after successful reset', async () => {
      const tokenSizeBefore = resetTokenStore.size;
      expect(tokenSizeBefore).toBe(1);

      await resetPassword(resetToken, 'newpassword123');

      // Verify token was removed
      expect(resetTokenStore.has(resetToken)).toBe(false);
    });
  });

  describe('Integration workflow', () => {
    beforeEach(() => {
      resetTokenStore.clear();
    });

    it('should complete full auth workflow', async () => {
      // 1. Register user
      const registerResult = await register(testRegisterInput);
      expect(registerResult.email).toBe('test@example.com');

      // 2. Login user
      const loginResult = await login(testLoginInput);
      expect(loginResult.user.email).toBe('test@example.com');
      expect(loginResult.token).toBeDefined();

      // 3. Forgot password
      const forgotResult = await forgotPassword('test@example.com');
      expect(forgotResult.success).toBe(true);

      // 4. Reset password
      let resetToken = '';
      for (const [token, data] of resetTokenStore.entries()) {
        if (data.email === 'test@example.com') {
          resetToken = token;
          break;
        }
      }

      const resetResult = await resetPassword(resetToken, 'newpassword123');
      expect(resetResult.success).toBe(true);

      // 5. Login with new password
      const newLoginResult = await login({
        email: 'test@example.com',
        password: 'newpassword123'
      });
      expect(newLoginResult.user.email).toBe('test@example.com');

      // 6. Logout
      const logoutResult = await logout(newLoginResult.user.id);
      expect(logoutResult.success).toBe(true);
    });

    it('should handle multiple users independently', async () => {
      // Register two users
      const user1 = await register(testRegisterInput);
      const user2 = await register(testInstructorInput);

      // Both should be able to login independently
      const login1 = await login(testLoginInput);
      const login2 = await login({
        email: 'instructor@example.com',
        password: 'instructor123'
      });

      expect(login1.user.id).toBe(user1.id);
      expect(login2.user.id).toBe(user2.id);
      expect(login1.user.role).toBe('student');
      expect(login2.user.role).toBe('instructor');
    });
  });
});