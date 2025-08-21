import { db } from '../db';
import { paymentsTable, couponsTable, coursesTable, usersTable, enrollmentsTable } from '../db/schema';
import { type CreatePaymentInput, type Payment, type CreateCouponInput, type Coupon } from '../schema';
import { eq, and, or, isNull, lt, gte } from 'drizzle-orm';

export async function createPayment(input: CreatePaymentInput, userId: number): Promise<Payment> {
  try {
    // Verify user and course exist
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const course = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, input.course_id))
      .execute();

    if (course.length === 0) {
      throw new Error('Course not found');
    }

    let originalAmount = parseFloat(course[0].price);
    let finalAmount = originalAmount;
    let couponId = null;

    // Apply coupon if provided
    if (input.coupon_code) {
      const couponValidation = await validateCoupon(input.coupon_code, input.course_id);
      if (couponValidation.valid && couponValidation.coupon && couponValidation.discountAmount !== undefined) {
        couponId = couponValidation.coupon.id;
        finalAmount = originalAmount - couponValidation.discountAmount;
        
        // Increment coupon usage
        await db.update(couponsTable)
          .set({ used_count: couponValidation.coupon.used_count + 1 })
          .where(eq(couponsTable.id, couponId))
          .execute();
      }
    }

    // Create payment record
    const result = await db.insert(paymentsTable)
      .values({
        user_id: userId,
        course_id: input.course_id,
        amount: finalAmount.toString(),
        original_amount: originalAmount.toString(),
        coupon_id: couponId,
        status: 'pending',
        payment_method: input.payment_method,
        transaction_id: null
      })
      .returning()
      .execute();

    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount),
      original_amount: parseFloat(payment.original_amount)
    };
  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
}

export async function processPayment(paymentId: number, transactionId: string): Promise<Payment> {
  try {
    // Update payment status
    const result = await db.update(paymentsTable)
      .set({ 
        status: 'completed',
        transaction_id: transactionId,
        updated_at: new Date()
      })
      .where(eq(paymentsTable.id, paymentId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = result[0];

    // Create enrollment for the user
    await db.insert(enrollmentsTable)
      .values({
        student_id: payment.user_id,
        course_id: payment.course_id,
        enrollment_date: new Date(),
        progress_percentage: 0,
        is_completed: false
      })
      .execute();

    return {
      ...payment,
      amount: parseFloat(payment.amount),
      original_amount: parseFloat(payment.original_amount)
    };
  } catch (error) {
    console.error('Payment processing failed:', error);
    throw error;
  }
}

export async function getUserPayments(userId: number): Promise<Payment[]> {
  try {
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.user_id, userId))
      .execute();

    return payments.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount),
      original_amount: parseFloat(payment.original_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch user payments:', error);
    throw error;
  }
}

export async function refundPayment(paymentId: number, reason: string): Promise<Payment> {
  try {
    // Update payment status to refunded
    const result = await db.update(paymentsTable)
      .set({ 
        status: 'refunded',
        updated_at: new Date()
      })
      .where(eq(paymentsTable.id, paymentId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = result[0];

    // Remove enrollment (cancel access)
    await db.delete(enrollmentsTable)
      .where(and(
        eq(enrollmentsTable.student_id, payment.user_id),
        eq(enrollmentsTable.course_id, payment.course_id)
      ))
      .execute();

    return {
      ...payment,
      amount: parseFloat(payment.amount),
      original_amount: parseFloat(payment.original_amount)
    };
  } catch (error) {
    console.error('Payment refund failed:', error);
    throw error;
  }
}

export async function createCoupon(input: CreateCouponInput): Promise<Coupon> {
  try {
    const result = await db.insert(couponsTable)
      .values({
        code: input.code,
        discount_type: input.discount_type,
        discount_value: input.discount_value.toString(),
        max_uses: input.max_uses,
        used_count: 0,
        expires_at: input.expires_at,
        is_active: true
      })
      .returning()
      .execute();

    const coupon = result[0];
    return {
      ...coupon,
      discount_value: parseFloat(coupon.discount_value)
    };
  } catch (error) {
    console.error('Coupon creation failed:', error);
    throw error;
  }
}

export async function validateCoupon(couponCode: string, courseId: number): Promise<{
  valid: boolean;
  coupon?: Coupon;
  discountAmount?: number;
  message?: string;
}> {
  try {
    // Find the coupon
    const coupons = await db.select()
      .from(couponsTable)
      .where(eq(couponsTable.code, couponCode))
      .execute();

    if (coupons.length === 0) {
      return {
        valid: false,
        message: 'Coupon not found'
      };
    }

    const coupon = {
      ...coupons[0],
      discount_value: parseFloat(coupons[0].discount_value)
    };

    // Check if coupon is active
    if (!coupon.is_active) {
      return {
        valid: false,
        coupon,
        message: 'Coupon is inactive'
      };
    }

    // Check expiration
    if (coupon.expires_at && new Date() > coupon.expires_at) {
      return {
        valid: false,
        coupon,
        message: 'Coupon has expired'
      };
    }

    // Check usage limits
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return {
        valid: false,
        coupon,
        message: 'Coupon usage limit exceeded'
      };
    }

    // Get course price to calculate discount
    const courses = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .execute();

    if (courses.length === 0) {
      return {
        valid: false,
        coupon,
        message: 'Course not found'
      };
    }

    const coursePrice = parseFloat(courses[0].price);
    let discountAmount = 0;

    if (coupon.discount_type === 'percentage') {
      discountAmount = coursePrice * (coupon.discount_value / 100);
    } else {
      discountAmount = coupon.discount_value;
    }

    // Ensure discount doesn't exceed course price
    discountAmount = Math.min(discountAmount, coursePrice);

    return {
      valid: true,
      coupon,
      discountAmount,
      message: 'Coupon is valid'
    };
  } catch (error) {
    console.error('Coupon validation failed:', error);
    return {
      valid: false,
      message: 'Error validating coupon'
    };
  }
}

export async function getCoupons(): Promise<Coupon[]> {
  try {
    const coupons = await db.select()
      .from(couponsTable)
      .execute();

    return coupons.map(coupon => ({
      ...coupon,
      discount_value: parseFloat(coupon.discount_value)
    }));
  } catch (error) {
    console.error('Failed to fetch coupons:', error);
    throw error;
  }
}

export async function deactivateCoupon(couponId: number): Promise<Coupon> {
  try {
    const result = await db.update(couponsTable)
      .set({ is_active: false })
      .where(eq(couponsTable.id, couponId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Coupon not found');
    }

    const coupon = result[0];
    return {
      ...coupon,
      discount_value: parseFloat(coupon.discount_value)
    };
  } catch (error) {
    console.error('Coupon deactivation failed:', error);
    throw error;
  }
}