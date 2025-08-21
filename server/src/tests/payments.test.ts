import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, paymentsTable, couponsTable, enrollmentsTable } from '../db/schema';
import { 
  createPayment, 
  processPayment, 
  getUserPayments, 
  refundPayment,
  createCoupon,
  validateCoupon,
  getCoupons,
  deactivateCoupon
} from '../handlers/payments';
import { type CreatePaymentInput, type CreateCouponInput } from '../schema';
import { eq, and } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'student@test.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'Student',
  role: 'student' as const
};

const testInstructor = {
  email: 'instructor@test.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'Instructor',
  role: 'instructor' as const
};

const testCourse = {
  title: 'Test Course',
  description: 'A test course',
  price: '99.99',
  duration_hours: '10.5',
  is_published: true
};

const testPaymentInput: CreatePaymentInput = {
  course_id: 1,
  payment_method: 'credit_card'
};

const testCouponInput: CreateCouponInput = {
  code: 'SAVE20',
  discount_type: 'percentage',
  discount_value: 20,
  max_uses: 100,
  expires_at: null
};

describe('Payment Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createPayment', () => {
    it('should create a payment without coupon', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          ...testCourse,
          instructor_id: instructorId
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      const paymentInput = { ...testPaymentInput, course_id: courseId };

      const result = await createPayment(paymentInput, userId);

      expect(result.user_id).toBe(userId);
      expect(result.course_id).toBe(courseId);
      expect(result.amount).toBe(99.99);
      expect(result.original_amount).toBe(99.99);
      expect(result.coupon_id).toBeNull();
      expect(result.status).toBe('pending');
      expect(result.payment_method).toBe('credit_card');
      expect(result.id).toBeDefined();
    });

    it('should create a payment with percentage coupon discount', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          ...testCourse,
          instructor_id: instructorId
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      const couponResult = await db.insert(couponsTable)
        .values({
          code: 'SAVE20',
          discount_type: 'percentage',
          discount_value: '20',
          max_uses: 100,
          used_count: 0,
          expires_at: null,
          is_active: true
        })
        .returning()
        .execute();

      const paymentInput = { 
        ...testPaymentInput, 
        course_id: courseId,
        coupon_code: 'SAVE20'
      };

      const result = await createPayment(paymentInput, userId);

      expect(result.amount).toBe(79.99); // 99.99 - 20%
      expect(result.original_amount).toBe(99.99);
      expect(result.coupon_id).toBe(couponResult[0].id);
    });

    it('should create a payment with fixed coupon discount', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          ...testCourse,
          instructor_id: instructorId
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      await db.insert(couponsTable)
        .values({
          code: 'SAVE10',
          discount_type: 'fixed',
          discount_value: '10',
          max_uses: null,
          used_count: 0,
          expires_at: null,
          is_active: true
        })
        .execute();

      const paymentInput = { 
        ...testPaymentInput, 
        course_id: courseId,
        coupon_code: 'SAVE10'
      };

      const result = await createPayment(paymentInput, userId);

      expect(result.amount).toBe(89.99); // 99.99 - 10
      expect(result.original_amount).toBe(99.99);
    });

    it('should throw error for non-existent user', async () => {
      const paymentInput = { ...testPaymentInput, course_id: 999 };

      await expect(createPayment(paymentInput, 999)).rejects.toThrow(/user not found/i);
    });

    it('should throw error for non-existent course', async () => {
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const paymentInput = { ...testPaymentInput, course_id: 999 };

      await expect(createPayment(paymentInput, userId)).rejects.toThrow(/course not found/i);
    });
  });

  describe('processPayment', () => {
    it('should process payment and create enrollment', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          ...testCourse,
          instructor_id: instructorId
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      const paymentResult = await db.insert(paymentsTable)
        .values({
          user_id: userId,
          course_id: courseId,
          amount: '99.99',
          original_amount: '99.99',
          status: 'pending',
          payment_method: 'credit_card'
        })
        .returning()
        .execute();
      const paymentId = paymentResult[0].id;

      const result = await processPayment(paymentId, 'txn_12345');

      expect(result.status).toBe('completed');
      expect(result.transaction_id).toBe('txn_12345');

      // Verify enrollment was created
      const enrollments = await db.select()
        .from(enrollmentsTable)
        .where(and(
          eq(enrollmentsTable.student_id, userId),
          eq(enrollmentsTable.course_id, courseId)
        ))
        .execute();

      expect(enrollments).toHaveLength(1);
      expect(enrollments[0].progress_percentage).toBe(0);
      expect(enrollments[0].is_completed).toBe(false);
    });

    it('should throw error for non-existent payment', async () => {
      await expect(processPayment(999, 'txn_12345')).rejects.toThrow(/payment not found/i);
    });
  });

  describe('getUserPayments', () => {
    it('should fetch all payments for a user', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          ...testCourse,
          instructor_id: instructorId
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      // Create multiple payments
      await db.insert(paymentsTable)
        .values([
          {
            user_id: userId,
            course_id: courseId,
            amount: '99.99',
            original_amount: '99.99',
            status: 'completed',
            payment_method: 'credit_card'
          },
          {
            user_id: userId,
            course_id: courseId,
            amount: '79.99',
            original_amount: '99.99',
            status: 'pending',
            payment_method: 'paypal'
          }
        ])
        .execute();

      const result = await getUserPayments(userId);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(99.99);
      expect(result[1].amount).toBe(79.99);
      expect(typeof result[0].amount).toBe('number');
      expect(typeof result[1].amount).toBe('number');
    });

    it('should return empty array for user with no payments', async () => {
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const result = await getUserPayments(userId);

      expect(result).toHaveLength(0);
    });
  });

  describe('refundPayment', () => {
    it('should refund payment and remove enrollment', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = userResult[0].id;

      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          ...testCourse,
          instructor_id: instructorId
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      const paymentResult = await db.insert(paymentsTable)
        .values({
          user_id: userId,
          course_id: courseId,
          amount: '99.99',
          original_amount: '99.99',
          status: 'completed',
          payment_method: 'credit_card',
          transaction_id: 'txn_12345'
        })
        .returning()
        .execute();
      const paymentId = paymentResult[0].id;

      // Create enrollment
      await db.insert(enrollmentsTable)
        .values({
          student_id: userId,
          course_id: courseId,
          progress_percentage: 50
        })
        .execute();

      const result = await refundPayment(paymentId, 'Customer request');

      expect(result.status).toBe('refunded');

      // Verify enrollment was removed
      const enrollments = await db.select()
        .from(enrollmentsTable)
        .where(and(
          eq(enrollmentsTable.student_id, userId),
          eq(enrollmentsTable.course_id, courseId)
        ))
        .execute();

      expect(enrollments).toHaveLength(0);
    });

    it('should throw error for non-existent payment', async () => {
      await expect(refundPayment(999, 'Test reason')).rejects.toThrow(/payment not found/i);
    });
  });

  describe('createCoupon', () => {
    it('should create a coupon', async () => {
      const result = await createCoupon(testCouponInput);

      expect(result.code).toBe('SAVE20');
      expect(result.discount_type).toBe('percentage');
      expect(result.discount_value).toBe(20);
      expect(result.max_uses).toBe(100);
      expect(result.used_count).toBe(0);
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('should create a coupon without expiration', async () => {
      const couponInput = { ...testCouponInput, expires_at: null };
      
      const result = await createCoupon(couponInput);

      expect(result.expires_at).toBeNull();
    });

    it('should create a coupon with unlimited uses', async () => {
      const couponInput = { ...testCouponInput, max_uses: null };
      
      const result = await createCoupon(couponInput);

      expect(result.max_uses).toBeNull();
    });
  });

  describe('validateCoupon', () => {
    it('should validate active coupon successfully', async () => {
      // Create prerequisite data
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          ...testCourse,
          instructor_id: instructorId
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      await db.insert(couponsTable)
        .values({
          code: 'SAVE20',
          discount_type: 'percentage',
          discount_value: '20',
          max_uses: 100,
          used_count: 5,
          expires_at: null,
          is_active: true
        })
        .execute();

      const result = await validateCoupon('SAVE20', courseId);

      expect(result.valid).toBe(true);
      expect(result.coupon).toBeDefined();
      expect(result.discountAmount).toBe(19.998); // 99.99 * 0.2
      expect(result.message).toBe('Coupon is valid');
    });

    it('should reject non-existent coupon', async () => {
      const result = await validateCoupon('INVALID', 1);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Coupon not found');
    });

    it('should reject inactive coupon', async () => {
      await db.insert(couponsTable)
        .values({
          code: 'INACTIVE',
          discount_type: 'percentage',
          discount_value: '20',
          max_uses: 100,
          used_count: 0,
          expires_at: null,
          is_active: false
        })
        .execute();

      const result = await validateCoupon('INACTIVE', 1);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Coupon is inactive');
    });

    it('should reject expired coupon', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Yesterday

      await db.insert(couponsTable)
        .values({
          code: 'EXPIRED',
          discount_type: 'percentage',
          discount_value: '20',
          max_uses: 100,
          used_count: 0,
          expires_at: expiredDate,
          is_active: true
        })
        .execute();

      const result = await validateCoupon('EXPIRED', 1);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Coupon has expired');
    });

    it('should reject coupon with exceeded usage limit', async () => {
      await db.insert(couponsTable)
        .values({
          code: 'MAXED',
          discount_type: 'percentage',
          discount_value: '20',
          max_uses: 5,
          used_count: 5,
          expires_at: null,
          is_active: true
        })
        .execute();

      const result = await validateCoupon('MAXED', 1);

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Coupon usage limit exceeded');
    });

    it('should calculate fixed discount correctly', async () => {
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          ...testCourse,
          instructor_id: instructorId
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      await db.insert(couponsTable)
        .values({
          code: 'SAVE15',
          discount_type: 'fixed',
          discount_value: '15',
          max_uses: null,
          used_count: 0,
          expires_at: null,
          is_active: true
        })
        .execute();

      const result = await validateCoupon('SAVE15', courseId);

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(15);
    });

    it('should limit discount to course price', async () => {
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          ...testCourse,
          price: '50.00',
          instructor_id: instructorId
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      await db.insert(couponsTable)
        .values({
          code: 'BIGDISCOUNT',
          discount_type: 'fixed',
          discount_value: '100',
          max_uses: null,
          used_count: 0,
          expires_at: null,
          is_active: true
        })
        .execute();

      const result = await validateCoupon('BIGDISCOUNT', courseId);

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(50); // Limited to course price
    });
  });

  describe('getCoupons', () => {
    it('should fetch all coupons', async () => {
      await db.insert(couponsTable)
        .values([
          {
            code: 'SAVE10',
            discount_type: 'fixed',
            discount_value: '10',
            max_uses: 100,
            used_count: 5,
            expires_at: null,
            is_active: true
          },
          {
            code: 'SAVE20',
            discount_type: 'percentage',
            discount_value: '20',
            max_uses: null,
            used_count: 0,
            expires_at: null,
            is_active: false
          }
        ])
        .execute();

      const result = await getCoupons();

      expect(result).toHaveLength(2);
      expect(result[0].discount_value).toBe(10);
      expect(result[1].discount_value).toBe(20);
      expect(typeof result[0].discount_value).toBe('number');
      expect(typeof result[1].discount_value).toBe('number');
    });

    it('should return empty array when no coupons exist', async () => {
      const result = await getCoupons();

      expect(result).toHaveLength(0);
    });
  });

  describe('deactivateCoupon', () => {
    it('should deactivate a coupon', async () => {
      const couponResult = await db.insert(couponsTable)
        .values({
          code: 'ACTIVE',
          discount_type: 'percentage',
          discount_value: '20',
          max_uses: 100,
          used_count: 0,
          expires_at: null,
          is_active: true
        })
        .returning()
        .execute();
      const couponId = couponResult[0].id;

      const result = await deactivateCoupon(couponId);

      expect(result.is_active).toBe(false);
      expect(result.id).toBe(couponId);

      // Verify in database
      const updatedCoupons = await db.select()
        .from(couponsTable)
        .where(eq(couponsTable.id, couponId))
        .execute();

      expect(updatedCoupons[0].is_active).toBe(false);
    });

    it('should throw error for non-existent coupon', async () => {
      await expect(deactivateCoupon(999)).rejects.toThrow(/coupon not found/i);
    });
  });
});