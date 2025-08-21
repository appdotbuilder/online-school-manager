import { z } from 'zod';

// User roles enum
export const userRoleSchema = z.enum(['student', 'instructor', 'administrator']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Auth schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema,
  avatar_url: z.string().nullable(),
  is_active: z.boolean(),
  email_verified: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: userRoleSchema
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Course schemas
export const courseSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  thumbnail_url: z.string().nullable(),
  price: z.number(),
  instructor_id: z.number(),
  is_published: z.boolean(),
  duration_hours: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Course = z.infer<typeof courseSchema>;

export const createCourseInputSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  thumbnail_url: z.string().nullable(),
  price: z.number().nonnegative(),
  duration_hours: z.number().positive()
});

export type CreateCourseInput = z.infer<typeof createCourseInputSchema>;

// Lesson schemas
export const lessonSchema = z.object({
  id: z.number(),
  course_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  video_url: z.string().nullable(),
  content: z.string().nullable(),
  order_index: z.number().int(),
  duration_minutes: z.number(),
  is_published: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Lesson = z.infer<typeof lessonSchema>;

export const createLessonInputSchema = z.object({
  course_id: z.number(),
  title: z.string().min(1),
  description: z.string().nullable(),
  video_url: z.string().nullable(),
  content: z.string().nullable(),
  order_index: z.number().int(),
  duration_minutes: z.number().nonnegative()
});

export type CreateLessonInput = z.infer<typeof createLessonInputSchema>;

// Quiz schemas
export const quizSchema = z.object({
  id: z.number(),
  lesson_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  passing_score: z.number().min(0).max(100),
  time_limit_minutes: z.number().int().nullable(),
  max_attempts: z.number().int().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Quiz = z.infer<typeof quizSchema>;

export const createQuizInputSchema = z.object({
  lesson_id: z.number(),
  title: z.string().min(1),
  description: z.string().nullable(),
  passing_score: z.number().min(0).max(100),
  time_limit_minutes: z.number().int().nullable(),
  max_attempts: z.number().int().nullable()
});

export type CreateQuizInput = z.infer<typeof createQuizInputSchema>;

// Quiz question schemas
export const questionTypeSchema = z.enum(['multiple_choice', 'true_false', 'short_answer']);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const quizQuestionSchema = z.object({
  id: z.number(),
  quiz_id: z.number(),
  question_text: z.string(),
  question_type: questionTypeSchema,
  options: z.array(z.string()).nullable(),
  correct_answer: z.string(),
  points: z.number(),
  order_index: z.number().int(),
  created_at: z.coerce.date()
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const createQuizQuestionInputSchema = z.object({
  quiz_id: z.number(),
  question_text: z.string().min(1),
  question_type: questionTypeSchema,
  options: z.array(z.string()).nullable(),
  correct_answer: z.string(),
  points: z.number().positive(),
  order_index: z.number().int()
});

export type CreateQuizQuestionInput = z.infer<typeof createQuizQuestionInputSchema>;

// Quiz attempt schemas
export const quizAttemptSchema = z.object({
  id: z.number(),
  quiz_id: z.number(),
  student_id: z.number(),
  score: z.number(),
  total_points: z.number(),
  answers: z.record(z.string()),
  started_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable(),
  is_passed: z.boolean()
});

export type QuizAttempt = z.infer<typeof quizAttemptSchema>;

export const submitQuizInputSchema = z.object({
  quiz_id: z.number(),
  answers: z.record(z.string())
});

export type SubmitQuizInput = z.infer<typeof submitQuizInputSchema>;

// Enrollment schemas
export const enrollmentSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  course_id: z.number(),
  enrollment_date: z.coerce.date(),
  completion_date: z.coerce.date().nullable(),
  progress_percentage: z.number().min(0).max(100),
  is_completed: z.boolean()
});

export type Enrollment = z.infer<typeof enrollmentSchema>;

export const enrollInputSchema = z.object({
  course_id: z.number()
});

export type EnrollInput = z.infer<typeof enrollInputSchema>;

// Certificate schemas
export const certificateSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  course_id: z.number(),
  certificate_url: z.string().nullable(),
  issued_at: z.coerce.date(),
  certificate_code: z.string()
});

export type Certificate = z.infer<typeof certificateSchema>;

// Payment schemas
export const paymentStatusSchema = z.enum(['pending', 'completed', 'failed', 'refunded']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  course_id: z.number(),
  amount: z.number(),
  original_amount: z.number(),
  coupon_id: z.number().nullable(),
  status: paymentStatusSchema,
  payment_method: z.string().nullable(),
  transaction_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Payment = z.infer<typeof paymentSchema>;

export const createPaymentInputSchema = z.object({
  course_id: z.number(),
  coupon_code: z.string().optional(),
  payment_method: z.string()
});

export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

// Coupon schemas
export const couponSchema = z.object({
  id: z.number(),
  code: z.string(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number(),
  max_uses: z.number().int().nullable(),
  used_count: z.number().int(),
  expires_at: z.coerce.date().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date()
});

export type Coupon = z.infer<typeof couponSchema>;

export const createCouponInputSchema = z.object({
  code: z.string().min(1),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().positive(),
  max_uses: z.number().int().nullable(),
  expires_at: z.coerce.date().nullable()
});

export type CreateCouponInput = z.infer<typeof createCouponInputSchema>;

// Message schemas
export const messageSchema = z.object({
  id: z.number(),
  sender_id: z.number(),
  recipient_id: z.number(),
  subject: z.string(),
  content: z.string(),
  is_read: z.boolean(),
  sent_at: z.coerce.date()
});

export type Message = z.infer<typeof messageSchema>;

export const sendMessageInputSchema = z.object({
  recipient_id: z.number(),
  subject: z.string().min(1),
  content: z.string().min(1)
});

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

// Notification schemas
export const notificationTypeSchema = z.enum(['course_update', 'quiz_available', 'certificate_issued', 'message_received', 'payment_confirmed']);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  is_read: z.boolean(),
  created_at: z.coerce.date()
});

export type Notification = z.infer<typeof notificationSchema>;

export const createNotificationInputSchema = z.object({
  user_id: z.number(),
  type: notificationTypeSchema,
  title: z.string().min(1),
  message: z.string().min(1)
});

export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;

// Progress tracking schemas
export const lessonProgressSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  lesson_id: z.number(),
  is_completed: z.boolean(),
  watch_time_seconds: z.number().int(),
  completed_at: z.coerce.date().nullable(),
  last_accessed_at: z.coerce.date()
});

export type LessonProgress = z.infer<typeof lessonProgressSchema>;

export const updateProgressInputSchema = z.object({
  lesson_id: z.number(),
  watch_time_seconds: z.number().int().nonnegative(),
  is_completed: z.boolean().optional()
});

export type UpdateProgressInput = z.infer<typeof updateProgressInputSchema>;

// Additional input schemas for TRPC routes
export const userIdInputSchema = z.object({
  userId: z.number()
});

export const courseIdInputSchema = z.object({
  courseId: z.number()
});

export const lessonIdInputSchema = z.object({
  lessonId: z.number()
});

export const quizIdInputSchema = z.object({
  quizId: z.number()
});

export const attemptIdInputSchema = z.object({
  attemptId: z.number()
});

export const certificateCodeInputSchema = z.object({
  certificateCode: z.string()
});

export const certificateIdInputSchema = z.object({
  certificateId: z.number()
});

export const paymentIdInputSchema = z.object({
  paymentId: z.number()
});

export const couponCodeInputSchema = z.object({
  couponCode: z.string(),
  courseId: z.number()
});

export const couponIdInputSchema = z.object({
  couponId: z.number()
});

export const messageIdInputSchema = z.object({
  messageId: z.number()
});

export const messageTypeInputSchema = z.object({
  type: z.enum(['sent', 'received'])
});

export const notificationIdInputSchema = z.object({
  notificationId: z.number()
});

export const userStatusInputSchema = z.object({
  userId: z.number(),
  isActive: z.boolean()
});

export const courseModerationInputSchema = z.object({
  courseId: z.number(),
  action: z.enum(['approve', 'reject'])
});

export const dateRangeInputSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
});

export const exportFormatInputSchema = z.object({
  format: z.enum(['csv', 'json'])
});

export const emailInputSchema = z.object({
  email: z.string().email()
});

export const resetPasswordInputSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8)
});

export const courseUpdateInputSchema = z.object({
  courseId: z.number(),
  updates: createCourseInputSchema.partial()
});

export const lessonUpdateInputSchema = z.object({
  lessonId: z.number(),
  updates: createLessonInputSchema.partial()
});

export const quizUpdateInputSchema = z.object({
  quizId: z.number(),
  updates: createQuizInputSchema.partial()
});

export const lessonReorderInputSchema = z.object({
  courseId: z.number(),
  lessonOrders: z.array(z.object({
    lessonId: z.number(),
    orderIndex: z.number().int()
  }))
});

export const quizQuestionsInputSchema = z.object({
  quizId: z.number(),
  includeAnswers: z.boolean().default(false)
});

export const instructorIdInputSchema = z.object({
  instructorId: z.number()
});

export const processPaymentInputSchema = z.object({
  paymentId: z.number(),
  transactionId: z.string()
});

export const refundPaymentInputSchema = z.object({
  paymentId: z.number(),
  reason: z.string()
});