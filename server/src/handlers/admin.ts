import { db } from '../db';
import { 
  usersTable, 
  coursesTable, 
  enrollmentsTable, 
  paymentsTable, 
  certificatesTable 
} from '../db/schema';
import { type User, type Course, type Certificate, type Payment } from '../schema';
import { eq, desc, gte, lte, count, sum, and, isNull, sql, SQL } from 'drizzle-orm';

export async function getAllUsers(adminId: number): Promise<User[]> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    // Fetch all users
    const users = await db.select()
      .from(usersTable)
      .orderBy(desc(usersTable.created_at))
      .execute();

    // Return users without password_hash
    return users.map(user => ({
      ...user,
      password_hash: '[REDACTED]'
    }));
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}

export async function getUserById(userId: number, adminId: number): Promise<User | null> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    // Fetch specific user
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (!users.length) {
      return null;
    }

    // Return user without password_hash
    return {
      ...users[0],
      password_hash: '[REDACTED]'
    };
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error;
  }
}

export async function updateUserStatus(userId: number, isActive: boolean, adminId: number): Promise<User> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    // Update user status
    const result = await db.update(usersTable)
      .set({ 
        is_active: isActive,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .returning()
      .execute();

    if (!result.length) {
      throw new Error('User not found');
    }

    // Return user without password_hash
    return {
      ...result[0],
      password_hash: '[REDACTED]'
    };
  } catch (error) {
    console.error('Failed to update user status:', error);
    throw error;
  }
}

export async function deleteUser(userId: number, adminId: number): Promise<{ success: boolean }> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    // Check if user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (!user.length) {
      throw new Error('User not found');
    }

    // Delete user (CASCADE will handle related records)
    await db.delete(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
}

export async function getAllCourses(adminId: number): Promise<Course[]> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    // Fetch all courses including unpublished ones
    const courses = await db.select()
      .from(coursesTable)
      .orderBy(desc(coursesTable.created_at))
      .execute();

    // Convert numeric fields to numbers
    return courses.map(course => ({
      ...course,
      price: parseFloat(course.price),
      duration_hours: parseFloat(course.duration_hours)
    }));
  } catch (error) {
    console.error('Failed to fetch courses:', error);
    throw error;
  }
}

export async function moderateCourse(courseId: number, action: 'approve' | 'reject', adminId: number): Promise<Course> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    // Update course publication status
    const isPublished = action === 'approve';
    const result = await db.update(coursesTable)
      .set({ 
        is_published: isPublished,
        updated_at: new Date()
      })
      .where(eq(coursesTable.id, courseId))
      .returning()
      .execute();

    if (!result.length) {
      throw new Error('Course not found');
    }

    // Convert numeric fields to numbers
    return {
      ...result[0],
      price: parseFloat(result[0].price),
      duration_hours: parseFloat(result[0].duration_hours)
    };
  } catch (error) {
    console.error('Failed to moderate course:', error);
    throw error;
  }
}

export async function getSystemAnalytics(adminId: number): Promise<{
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  totalRevenue: number;
  monthlySignups: number;
  monthlyRevenue: number;
  popularCourses: Course[];
  recentUsers: User[];
}> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    // Get current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total users
    const totalUsersResult = await db.select({ count: count() })
      .from(usersTable)
      .execute();
    const totalUsers = totalUsersResult[0]?.count || 0;

    // Total courses
    const totalCoursesResult = await db.select({ count: count() })
      .from(coursesTable)
      .execute();
    const totalCourses = totalCoursesResult[0]?.count || 0;

    // Total enrollments
    const totalEnrollmentsResult = await db.select({ count: count() })
      .from(enrollmentsTable)
      .execute();
    const totalEnrollments = totalEnrollmentsResult[0]?.count || 0;

    // Total revenue
    const totalRevenueResult = await db.select({ 
      total: sum(paymentsTable.amount)
    })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, 'completed'))
      .execute();
    const totalRevenue = totalRevenueResult[0]?.total ? parseFloat(totalRevenueResult[0].total) : 0;

    // Monthly signups
    const monthlySignupsResult = await db.select({ count: count() })
      .from(usersTable)
      .where(gte(usersTable.created_at, startOfMonth))
      .execute();
    const monthlySignups = monthlySignupsResult[0]?.count || 0;

    // Monthly revenue
    const monthlyRevenueResult = await db.select({ 
      total: sum(paymentsTable.amount)
    })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.status, 'completed'),
          gte(paymentsTable.created_at, startOfMonth)
        )
      )
      .execute();
    const monthlyRevenue = monthlyRevenueResult[0]?.total ? parseFloat(monthlyRevenueResult[0].total) : 0;

    // Popular courses (top 5 by enrollment count)
    const popularCoursesData = await db.select({
      course: coursesTable,
      enrollmentCount: count(enrollmentsTable.id)
    })
      .from(coursesTable)
      .leftJoin(enrollmentsTable, eq(coursesTable.id, enrollmentsTable.course_id))
      .where(eq(coursesTable.is_published, true))
      .groupBy(coursesTable.id)
      .orderBy(desc(count(enrollmentsTable.id)))
      .limit(5)
      .execute();

    const popularCourses = popularCoursesData.map(item => ({
      ...item.course,
      price: parseFloat(item.course.price),
      duration_hours: parseFloat(item.course.duration_hours)
    }));

    // Recent users (last 10)
    const recentUsersData = await db.select()
      .from(usersTable)
      .orderBy(desc(usersTable.created_at))
      .limit(10)
      .execute();

    const recentUsers = recentUsersData.map(user => ({
      ...user,
      password_hash: '[REDACTED]'
    }));

    return {
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalRevenue,
      monthlySignups,
      monthlyRevenue,
      popularCourses,
      recentUsers
    };
  } catch (error) {
    console.error('Failed to get system analytics:', error);
    throw error;
  }
}

export async function getRevenueReport(adminId: number, startDate: Date, endDate: Date): Promise<{
  totalRevenue: number;
  totalTransactions: number;
  refundedAmount: number;
  courseRevenue: { courseId: number; courseName: string; revenue: number }[];
  dailyRevenue: { date: string; revenue: number }[];
}> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    const conditions: SQL<unknown>[] = [
      gte(paymentsTable.created_at, startDate),
      lte(paymentsTable.created_at, endDate)
    ];

    // Total revenue and transactions
    const completedConditions = [...conditions, eq(paymentsTable.status, 'completed')];
    const revenueResult = await db.select({
      totalRevenue: sum(paymentsTable.amount),
      totalTransactions: count()
    })
      .from(paymentsTable)
      .where(and(...completedConditions))
      .execute();

    const totalRevenue = revenueResult[0]?.totalRevenue ? parseFloat(revenueResult[0].totalRevenue) : 0;
    const totalTransactions = revenueResult[0]?.totalTransactions || 0;

    // Refunded amount
    const refundedConditions = [...conditions, eq(paymentsTable.status, 'refunded')];
    const refundedResult = await db.select({
      refundedAmount: sum(paymentsTable.amount)
    })
      .from(paymentsTable)
      .where(and(...refundedConditions))
      .execute();

    const refundedAmount = refundedResult[0]?.refundedAmount ? parseFloat(refundedResult[0].refundedAmount) : 0;

    // Course revenue breakdown
    const courseRevenueData = await db.select({
      courseId: coursesTable.id,
      courseName: coursesTable.title,
      revenue: sum(paymentsTable.amount)
    })
      .from(paymentsTable)
      .innerJoin(coursesTable, eq(paymentsTable.course_id, coursesTable.id))
      .where(and(...completedConditions))
      .groupBy(coursesTable.id, coursesTable.title)
      .orderBy(desc(sum(paymentsTable.amount)))
      .execute();

    const courseRevenue = courseRevenueData.map(item => ({
      courseId: item.courseId,
      courseName: item.courseName,
      revenue: item.revenue ? parseFloat(item.revenue) : 0
    }));

    // Daily revenue
    const dailyRevenueData = await db.select({
      date: sql<string>`DATE(${paymentsTable.created_at})`,
      revenue: sum(paymentsTable.amount)
    })
      .from(paymentsTable)
      .where(and(...completedConditions))
      .groupBy(sql`DATE(${paymentsTable.created_at})`)
      .orderBy(sql`DATE(${paymentsTable.created_at})`)
      .execute();

    const dailyRevenue = dailyRevenueData.map(item => ({
      date: item.date,
      revenue: item.revenue ? parseFloat(item.revenue) : 0
    }));

    return {
      totalRevenue,
      totalTransactions,
      refundedAmount,
      courseRevenue,
      dailyRevenue
    };
  } catch (error) {
    console.error('Failed to get revenue report:', error);
    throw error;
  }
}

export async function getCertificateStats(adminId: number): Promise<{
  totalCertificates: number;
  monthlyCertificates: number;
  topPerformingCourses: { courseId: number; courseName: string; certificatesIssued: number }[];
}> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    // Get current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total certificates
    const totalCertificatesResult = await db.select({ count: count() })
      .from(certificatesTable)
      .execute();
    const totalCertificates = totalCertificatesResult[0]?.count || 0;

    // Monthly certificates
    const monthlyCertificatesResult = await db.select({ count: count() })
      .from(certificatesTable)
      .where(gte(certificatesTable.issued_at, startOfMonth))
      .execute();
    const monthlyCertificates = monthlyCertificatesResult[0]?.count || 0;

    // Top performing courses by certificates issued
    const topPerformingData = await db.select({
      courseId: coursesTable.id,
      courseName: coursesTable.title,
      certificatesIssued: count(certificatesTable.id)
    })
      .from(coursesTable)
      .innerJoin(certificatesTable, eq(coursesTable.id, certificatesTable.course_id))
      .groupBy(coursesTable.id, coursesTable.title)
      .orderBy(desc(count(certificatesTable.id)))
      .limit(10)
      .execute();

    const topPerformingCourses = topPerformingData.map(item => ({
      courseId: item.courseId,
      courseName: item.courseName,
      certificatesIssued: item.certificatesIssued
    }));

    return {
      totalCertificates,
      monthlyCertificates,
      topPerformingCourses
    };
  } catch (error) {
    console.error('Failed to get certificate stats:', error);
    throw error;
  }
}

export async function exportUserData(adminId: number, format: 'csv' | 'json'): Promise<{ downloadUrl: string }> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    // In a real implementation, this would:
    // 1. Generate the export file
    // 2. Store it in a secure location (S3, etc.)
    // 3. Return a signed URL with expiration
    
    // For now, return a mock URL
    const timestamp = Date.now();
    return { 
      downloadUrl: `https://exports.example.com/users_${timestamp}.${format}` 
    };
  } catch (error) {
    console.error('Failed to export user data:', error);
    throw error;
  }
}

export async function exportCourseData(adminId: number, format: 'csv' | 'json'): Promise<{ downloadUrl: string }> {
  try {
    // Verify admin permissions
    const admin = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, adminId))
      .execute();

    if (!admin.length || admin[0].role !== 'administrator') {
      throw new Error('Unauthorized: Admin access required');
    }

    // In a real implementation, this would:
    // 1. Generate the export file with course and enrollment data
    // 2. Store it in a secure location (S3, etc.)
    // 3. Return a signed URL with expiration
    
    // For now, return a mock URL
    const timestamp = Date.now();
    return { 
      downloadUrl: `https://exports.example.com/courses_${timestamp}.${format}` 
    };
  } catch (error) {
    console.error('Failed to export course data:', error);
    throw error;
  }
}