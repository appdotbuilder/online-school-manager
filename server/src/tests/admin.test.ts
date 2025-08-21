import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, enrollmentsTable, paymentsTable, certificatesTable } from '../db/schema';
import { 
  getAllUsers, 
  getUserById, 
  updateUserStatus, 
  deleteUser,
  getAllCourses,
  moderateCourse,
  getSystemAnalytics,
  getRevenueReport,
  getCertificateStats,
  exportUserData,
  exportCourseData
} from '../handlers/admin';
import { eq } from 'drizzle-orm';

describe('Admin Handler', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let adminId: number;
  let regularUserId: number;
  let instructorId: number;
  let courseId: number;

  beforeEach(async () => {
    // Create test admin user
    const adminResult = await db.insert(usersTable).values({
      email: 'admin@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Admin',
      last_name: 'User',
      role: 'administrator',
      is_active: true,
      email_verified: true
    }).returning().execute();
    adminId = adminResult[0].id;

    // Create test regular user
    const userResult = await db.insert(usersTable).values({
      email: 'user@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Regular',
      last_name: 'User',
      role: 'student',
      is_active: true,
      email_verified: true
    }).returning().execute();
    regularUserId = userResult[0].id;

    // Create test instructor
    const instructorResult = await db.insert(usersTable).values({
      email: 'instructor@test.com',
      password_hash: 'hashedpassword',
      first_name: 'Test',
      last_name: 'Instructor',
      role: 'instructor',
      is_active: true,
      email_verified: true
    }).returning().execute();
    instructorId = instructorResult[0].id;

    // Create test course
    const courseResult = await db.insert(coursesTable).values({
      title: 'Test Course',
      description: 'A test course',
      price: '99.99',
      instructor_id: instructorId,
      is_published: false,
      duration_hours: '10.5'
    }).returning().execute();
    courseId = courseResult[0].id;
  });

  describe('getAllUsers', () => {
    it('should return all users for admin', async () => {
      const users = await getAllUsers(adminId);

      expect(users).toHaveLength(3); // admin, regular user, instructor
      expect(users[0].password_hash).toEqual('[REDACTED]');
      
      const userEmails = users.map(u => u.email);
      expect(userEmails).toContain('admin@test.com');
      expect(userEmails).toContain('user@test.com');
      expect(userEmails).toContain('instructor@test.com');
    });

    it('should reject non-admin access', async () => {
      await expect(getAllUsers(regularUserId)).rejects.toThrow(/Unauthorized: Admin access required/i);
    });

    it('should reject invalid user id', async () => {
      await expect(getAllUsers(99999)).rejects.toThrow(/Unauthorized: Admin access required/i);
    });
  });

  describe('getUserById', () => {
    it('should return specific user for admin', async () => {
      const user = await getUserById(regularUserId, adminId);

      expect(user).not.toBeNull();
      expect(user!.id).toEqual(regularUserId);
      expect(user!.email).toEqual('user@test.com');
      expect(user!.password_hash).toEqual('[REDACTED]');
    });

    it('should return null for non-existent user', async () => {
      const user = await getUserById(99999, adminId);
      expect(user).toBeNull();
    });

    it('should reject non-admin access', async () => {
      await expect(getUserById(regularUserId, regularUserId)).rejects.toThrow(/Unauthorized: Admin access required/i);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status', async () => {
      const updatedUser = await updateUserStatus(regularUserId, false, adminId);

      expect(updatedUser.id).toEqual(regularUserId);
      expect(updatedUser.is_active).toBe(false);
      expect(updatedUser.password_hash).toEqual('[REDACTED]');

      // Verify in database
      const dbUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, regularUserId))
        .execute();
      expect(dbUser[0].is_active).toBe(false);
    });

    it('should reject non-admin access', async () => {
      await expect(updateUserStatus(regularUserId, false, regularUserId)).rejects.toThrow(/Unauthorized: Admin access required/i);
    });

    it('should throw error for non-existent user', async () => {
      await expect(updateUserStatus(99999, false, adminId)).rejects.toThrow(/User not found/i);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const result = await deleteUser(regularUserId, adminId);

      expect(result.success).toBe(true);

      // Verify user is deleted
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, regularUserId))
        .execute();
      expect(users).toHaveLength(0);
    });

    it('should reject non-admin access', async () => {
      await expect(deleteUser(regularUserId, regularUserId)).rejects.toThrow(/Unauthorized: Admin access required/i);
    });

    it('should throw error for non-existent user', async () => {
      await expect(deleteUser(99999, adminId)).rejects.toThrow(/User not found/i);
    });
  });

  describe('getAllCourses', () => {
    it('should return all courses including unpublished', async () => {
      const courses = await getAllCourses(adminId);

      expect(courses).toHaveLength(1);
      expect(courses[0].id).toEqual(courseId);
      expect(courses[0].title).toEqual('Test Course');
      expect(courses[0].is_published).toBe(false);
      expect(typeof courses[0].price).toBe('number');
      expect(courses[0].price).toEqual(99.99);
    });

    it('should reject non-admin access', async () => {
      await expect(getAllCourses(regularUserId)).rejects.toThrow(/Unauthorized: Admin access required/i);
    });
  });

  describe('moderateCourse', () => {
    it('should approve course publication', async () => {
      const moderatedCourse = await moderateCourse(courseId, 'approve', adminId);

      expect(moderatedCourse.id).toEqual(courseId);
      expect(moderatedCourse.is_published).toBe(true);
      expect(typeof moderatedCourse.price).toBe('number');

      // Verify in database
      const dbCourse = await db.select()
        .from(coursesTable)
        .where(eq(coursesTable.id, courseId))
        .execute();
      expect(dbCourse[0].is_published).toBe(true);
    });

    it('should reject course publication', async () => {
      const moderatedCourse = await moderateCourse(courseId, 'reject', adminId);

      expect(moderatedCourse.id).toEqual(courseId);
      expect(moderatedCourse.is_published).toBe(false);
    });

    it('should reject non-admin access', async () => {
      await expect(moderateCourse(courseId, 'approve', regularUserId)).rejects.toThrow(/Unauthorized: Admin access required/i);
    });

    it('should throw error for non-existent course', async () => {
      await expect(moderateCourse(99999, 'approve', adminId)).rejects.toThrow(/Course not found/i);
    });
  });

  describe('getSystemAnalytics', () => {
    beforeEach(async () => {
      // Create enrollment
      await db.insert(enrollmentsTable).values({
        student_id: regularUserId,
        course_id: courseId,
        progress_percentage: 50
      }).execute();

      // Create payment
      await db.insert(paymentsTable).values({
        user_id: regularUserId,
        course_id: courseId,
        amount: '99.99',
        original_amount: '99.99',
        status: 'completed',
        payment_method: 'credit_card'
      }).execute();

      // Create certificate
      await db.insert(certificatesTable).values({
        student_id: regularUserId,
        course_id: courseId,
        certificate_code: 'CERT123456'
      }).execute();
    });

    it('should return comprehensive system analytics', async () => {
      const analytics = await getSystemAnalytics(adminId);

      expect(analytics.totalUsers).toEqual(3);
      expect(analytics.totalCourses).toEqual(1);
      expect(analytics.totalEnrollments).toEqual(1);
      expect(analytics.totalRevenue).toEqual(99.99);
      expect(typeof analytics.monthlySignups).toBe('number');
      expect(typeof analytics.monthlyRevenue).toBe('number');
      expect(Array.isArray(analytics.popularCourses)).toBe(true);
      expect(Array.isArray(analytics.recentUsers)).toBe(true);
      expect(analytics.recentUsers).toHaveLength(3);
    });

    it('should reject non-admin access', async () => {
      await expect(getSystemAnalytics(regularUserId)).rejects.toThrow(/Unauthorized: Admin access required/i);
    });
  });

  describe('getRevenueReport', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create completed payment
      await db.insert(paymentsTable).values({
        user_id: regularUserId,
        course_id: courseId,
        amount: '99.99',
        original_amount: '99.99',
        status: 'completed',
        payment_method: 'credit_card',
        created_at: yesterday
      }).execute();

      // Create refunded payment
      await db.insert(paymentsTable).values({
        user_id: regularUserId,
        course_id: courseId,
        amount: '49.99',
        original_amount: '49.99',
        status: 'refunded',
        payment_method: 'credit_card',
        created_at: yesterday
      }).execute();
    });

    it('should return revenue report for date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const report = await getRevenueReport(adminId, startDate, endDate);

      expect(typeof report.totalRevenue).toBe('number');
      expect(typeof report.totalTransactions).toBe('number');
      expect(typeof report.refundedAmount).toBe('number');
      expect(Array.isArray(report.courseRevenue)).toBe(true);
      expect(Array.isArray(report.dailyRevenue)).toBe(true);

      if (report.totalRevenue > 0) {
        expect(report.totalRevenue).toEqual(99.99);
        expect(report.totalTransactions).toEqual(1);
      }
      if (report.refundedAmount > 0) {
        expect(report.refundedAmount).toEqual(49.99);
      }
    });

    it('should reject non-admin access', async () => {
      const startDate = new Date();
      const endDate = new Date();
      await expect(getRevenueReport(regularUserId, startDate, endDate)).rejects.toThrow(/Unauthorized: Admin access required/i);
    });
  });

  describe('getCertificateStats', () => {
    beforeEach(async () => {
      // Create certificate
      await db.insert(certificatesTable).values({
        student_id: regularUserId,
        course_id: courseId,
        certificate_code: 'CERT123456'
      }).execute();
    });

    it('should return certificate statistics', async () => {
      const stats = await getCertificateStats(adminId);

      expect(typeof stats.totalCertificates).toBe('number');
      expect(typeof stats.monthlyCertificates).toBe('number');
      expect(Array.isArray(stats.topPerformingCourses)).toBe(true);
      expect(stats.totalCertificates).toEqual(1);

      if (stats.topPerformingCourses.length > 0) {
        expect(stats.topPerformingCourses[0].courseId).toEqual(courseId);
        expect(stats.topPerformingCourses[0].courseName).toEqual('Test Course');
        expect(stats.topPerformingCourses[0].certificatesIssued).toEqual(1);
      }
    });

    it('should reject non-admin access', async () => {
      await expect(getCertificateStats(regularUserId)).rejects.toThrow(/Unauthorized: Admin access required/i);
    });
  });

  describe('exportUserData', () => {
    it('should return download URL for user export', async () => {
      const result = await exportUserData(adminId, 'csv');

      expect(result.downloadUrl).toContain('users_');
      expect(result.downloadUrl).toContain('.csv');
      expect(result.downloadUrl).toMatch(/^https:\/\//);
    });

    it('should support JSON format', async () => {
      const result = await exportUserData(adminId, 'json');

      expect(result.downloadUrl).toContain('.json');
    });

    it('should reject non-admin access', async () => {
      await expect(exportUserData(regularUserId, 'csv')).rejects.toThrow(/Unauthorized: Admin access required/i);
    });
  });

  describe('exportCourseData', () => {
    it('should return download URL for course export', async () => {
      const result = await exportCourseData(adminId, 'csv');

      expect(result.downloadUrl).toContain('courses_');
      expect(result.downloadUrl).toContain('.csv');
      expect(result.downloadUrl).toMatch(/^https:\/\//);
    });

    it('should support JSON format', async () => {
      const result = await exportCourseData(adminId, 'json');

      expect(result.downloadUrl).toContain('.json');
    });

    it('should reject non-admin access', async () => {
      await expect(exportCourseData(regularUserId, 'csv')).rejects.toThrow(/Unauthorized: Admin access required/i);
    });
  });
});