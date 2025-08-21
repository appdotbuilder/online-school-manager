import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  pgEnum,
  jsonb
} from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['student', 'instructor', 'administrator']);
export const questionTypeEnum = pgEnum('question_type', ['multiple_choice', 'true_false', 'short_answer']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'completed', 'failed', 'refunded']);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed']);
export const notificationTypeEnum = pgEnum('notification_type', ['course_update', 'quiz_available', 'certificate_issued', 'message_received', 'payment_confirmed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull(),
  avatar_url: text('avatar_url'),
  is_active: boolean('is_active').notNull().default(true),
  email_verified: boolean('email_verified').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Courses table
export const coursesTable = pgTable('courses', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  thumbnail_url: text('thumbnail_url'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  instructor_id: integer('instructor_id').notNull().references(() => usersTable.id),
  is_published: boolean('is_published').notNull().default(false),
  duration_hours: numeric('duration_hours', { precision: 5, scale: 2 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Lessons table
export const lessonsTable = pgTable('lessons', {
  id: serial('id').primaryKey(),
  course_id: integer('course_id').notNull().references(() => coursesTable.id),
  title: text('title').notNull(),
  description: text('description'),
  video_url: text('video_url'),
  content: text('content'),
  order_index: integer('order_index').notNull(),
  duration_minutes: integer('duration_minutes').notNull(),
  is_published: boolean('is_published').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Quizzes table
export const quizzesTable = pgTable('quizzes', {
  id: serial('id').primaryKey(),
  lesson_id: integer('lesson_id').notNull().references(() => lessonsTable.id),
  title: text('title').notNull(),
  description: text('description'),
  passing_score: integer('passing_score').notNull(),
  time_limit_minutes: integer('time_limit_minutes'),
  max_attempts: integer('max_attempts'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Quiz questions table
export const quizQuestionsTable = pgTable('quiz_questions', {
  id: serial('id').primaryKey(),
  quiz_id: integer('quiz_id').notNull().references(() => quizzesTable.id),
  question_text: text('question_text').notNull(),
  question_type: questionTypeEnum('question_type').notNull(),
  options: jsonb('options'), // Array of options for multiple choice
  correct_answer: text('correct_answer').notNull(),
  points: integer('points').notNull(),
  order_index: integer('order_index').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Quiz attempts table
export const quizAttemptsTable = pgTable('quiz_attempts', {
  id: serial('id').primaryKey(),
  quiz_id: integer('quiz_id').notNull().references(() => quizzesTable.id),
  student_id: integer('student_id').notNull().references(() => usersTable.id),
  score: integer('score').notNull(),
  total_points: integer('total_points').notNull(),
  answers: jsonb('answers').notNull(), // JSON object with question_id: answer pairs
  started_at: timestamp('started_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
  is_passed: boolean('is_passed').notNull()
});

// Enrollments table
export const enrollmentsTable = pgTable('enrollments', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => usersTable.id),
  course_id: integer('course_id').notNull().references(() => coursesTable.id),
  enrollment_date: timestamp('enrollment_date').defaultNow().notNull(),
  completion_date: timestamp('completion_date'),
  progress_percentage: integer('progress_percentage').notNull().default(0),
  is_completed: boolean('is_completed').notNull().default(false)
});

// Certificates table
export const certificatesTable = pgTable('certificates', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => usersTable.id),
  course_id: integer('course_id').notNull().references(() => coursesTable.id),
  certificate_url: text('certificate_url'),
  issued_at: timestamp('issued_at').defaultNow().notNull(),
  certificate_code: text('certificate_code').notNull().unique()
});

// Payments table
export const paymentsTable = pgTable('payments', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  course_id: integer('course_id').notNull().references(() => coursesTable.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  original_amount: numeric('original_amount', { precision: 10, scale: 2 }).notNull(),
  coupon_id: integer('coupon_id').references(() => couponsTable.id),
  status: paymentStatusEnum('status').notNull().default('pending'),
  payment_method: text('payment_method'),
  transaction_id: text('transaction_id'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Coupons table
export const couponsTable = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  discount_type: discountTypeEnum('discount_type').notNull(),
  discount_value: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
  max_uses: integer('max_uses'),
  used_count: integer('used_count').notNull().default(0),
  expires_at: timestamp('expires_at'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Messages table
export const messagesTable = pgTable('messages', {
  id: serial('id').primaryKey(),
  sender_id: integer('sender_id').notNull().references(() => usersTable.id),
  recipient_id: integer('recipient_id').notNull().references(() => usersTable.id),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  is_read: boolean('is_read').notNull().default(false),
  sent_at: timestamp('sent_at').defaultNow().notNull()
});

// Notifications table
export const notificationsTable = pgTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  is_read: boolean('is_read').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Lesson progress table
export const lessonProgressTable = pgTable('lesson_progress', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => usersTable.id),
  lesson_id: integer('lesson_id').notNull().references(() => lessonsTable.id),
  is_completed: boolean('is_completed').notNull().default(false),
  watch_time_seconds: integer('watch_time_seconds').notNull().default(0),
  completed_at: timestamp('completed_at'),
  last_accessed_at: timestamp('last_accessed_at').defaultNow().notNull()
});



// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Course = typeof coursesTable.$inferSelect;
export type NewCourse = typeof coursesTable.$inferInsert;

export type Lesson = typeof lessonsTable.$inferSelect;
export type NewLesson = typeof lessonsTable.$inferInsert;

export type Quiz = typeof quizzesTable.$inferSelect;
export type NewQuiz = typeof quizzesTable.$inferInsert;

export type QuizQuestion = typeof quizQuestionsTable.$inferSelect;
export type NewQuizQuestion = typeof quizQuestionsTable.$inferInsert;

export type QuizAttempt = typeof quizAttemptsTable.$inferSelect;
export type NewQuizAttempt = typeof quizAttemptsTable.$inferInsert;

export type Enrollment = typeof enrollmentsTable.$inferSelect;
export type NewEnrollment = typeof enrollmentsTable.$inferInsert;

export type Certificate = typeof certificatesTable.$inferSelect;
export type NewCertificate = typeof certificatesTable.$inferInsert;

export type Payment = typeof paymentsTable.$inferSelect;
export type NewPayment = typeof paymentsTable.$inferInsert;

export type Coupon = typeof couponsTable.$inferSelect;
export type NewCoupon = typeof couponsTable.$inferInsert;

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;

export type LessonProgress = typeof lessonProgressTable.$inferSelect;
export type NewLessonProgress = typeof lessonProgressTable.$inferInsert;

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  courses: coursesTable,
  lessons: lessonsTable,
  quizzes: quizzesTable,
  quizQuestions: quizQuestionsTable,
  quizAttempts: quizAttemptsTable,
  enrollments: enrollmentsTable,
  certificates: certificatesTable,
  payments: paymentsTable,
  coupons: couponsTable,
  messages: messagesTable,
  notifications: notificationsTable,
  lessonProgress: lessonProgressTable
};