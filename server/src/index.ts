import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import {
  registerInputSchema,
  loginInputSchema,
  createCourseInputSchema,
  createLessonInputSchema,
  createQuizInputSchema,
  createQuizQuestionInputSchema,
  submitQuizInputSchema,
  enrollInputSchema,
  updateProgressInputSchema,
  createPaymentInputSchema,
  createCouponInputSchema,
  sendMessageInputSchema,
  createNotificationInputSchema,
  userIdInputSchema,
  courseIdInputSchema,
  lessonIdInputSchema,
  quizIdInputSchema,
  attemptIdInputSchema,
  certificateCodeInputSchema,
  certificateIdInputSchema,
  paymentIdInputSchema,
  couponCodeInputSchema,
  couponIdInputSchema,
  messageIdInputSchema,
  messageTypeInputSchema,
  notificationIdInputSchema,
  userStatusInputSchema,
  courseModerationInputSchema,
  dateRangeInputSchema,
  exportFormatInputSchema,
  emailInputSchema,
  resetPasswordInputSchema,
  courseUpdateInputSchema,
  lessonUpdateInputSchema,
  quizUpdateInputSchema,
  lessonReorderInputSchema,
  quizQuestionsInputSchema,
  instructorIdInputSchema,
  processPaymentInputSchema,
  refundPaymentInputSchema
} from './schema';

// Import handlers
import { register, login, logout, forgotPassword, resetPassword } from './handlers/auth';
import { 
  createCourse, 
  getCourses, 
  getCourseById, 
  getInstructorCourses, 
  updateCourse, 
  publishCourse, 
  deleteCourse 
} from './handlers/courses';
import { 
  createLesson, 
  getLessonsByCourse, 
  getLessonById, 
  updateLesson, 
  publishLesson, 
  deleteLesson, 
  reorderLessons 
} from './handlers/lessons';
import { 
  createQuiz, 
  createQuizQuestion, 
  getQuizById, 
  getQuizQuestions, 
  submitQuiz, 
  getQuizAttempts, 
  getStudentQuizAttempt, 
  updateQuiz, 
  deleteQuiz 
} from './handlers/quizzes';
import { 
  enrollInCourse, 
  getStudentEnrollments, 
  getCourseEnrollments, 
  updateLessonProgress, 
  getStudentProgress, 
  completeCourse, 
  unenrollFromCourse 
} from './handlers/enrollments';
import { 
  generateCertificate, 
  getStudentCertificates, 
  getCertificateByCode, 
  getCertificateById, 
  regenerateCertificate, 
  getCourseCompletionStats 
} from './handlers/certificates';
import { 
  createPayment, 
  processPayment, 
  getUserPayments, 
  refundPayment, 
  createCoupon, 
  validateCoupon, 
  getCoupons, 
  deactivateCoupon 
} from './handlers/payments';
import { 
  sendMessage, 
  getUserMessages, 
  getMessageById, 
  markMessageAsRead, 
  deleteMessage, 
  createNotification, 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from './handlers/messages';
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
} from './handlers/admin';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(({ input }) => register(input)),
  
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),
  
  logout: publicProcedure
    .input(userIdInputSchema)
    .mutation(({ input }) => logout(input.userId)),
  
  forgotPassword: publicProcedure
    .input(emailInputSchema)
    .mutation(({ input }) => forgotPassword(input.email)),
  
  resetPassword: publicProcedure
    .input(resetPasswordInputSchema)
    .mutation(({ input }) => resetPassword(input.token, input.newPassword)),

  // Course management routes
  createCourse: publicProcedure
    .input(createCourseInputSchema)
    .mutation(({ input }) => createCourse(input, 1)), // TODO: Extract instructor ID from auth
  
  getCourses: publicProcedure
    .query(() => getCourses()),
  
  getCourse: publicProcedure
    .input(courseIdInputSchema)
    .query(({ input }) => getCourseById(input.courseId)),
  
  getInstructorCourses: publicProcedure
    .input(instructorIdInputSchema)
    .query(({ input }) => getInstructorCourses(input.instructorId)),
  
  updateCourse: publicProcedure
    .input(courseUpdateInputSchema)
    .mutation(({ input }) => updateCourse(input.courseId, input.updates, 1)), // TODO: Extract instructor ID
  
  publishCourse: publicProcedure
    .input(courseIdInputSchema)
    .mutation(({ input }) => publishCourse(input.courseId, 1)), // TODO: Extract instructor ID
  
  deleteCourse: publicProcedure
    .input(courseIdInputSchema)
    .mutation(({ input }) => deleteCourse(input.courseId, 1)), // TODO: Extract instructor ID

  // Lesson management routes
  createLesson: publicProcedure
    .input(createLessonInputSchema)
    .mutation(({ input }) => createLesson(input)),
  
  getLessonsByCourse: publicProcedure
    .input(courseIdInputSchema)
    .query(({ input }) => getLessonsByCourse(input.courseId)),
  
  getLesson: publicProcedure
    .input(lessonIdInputSchema)
    .query(({ input }) => getLessonById(input.lessonId)),
  
  updateLesson: publicProcedure
    .input(lessonUpdateInputSchema)
    .mutation(({ input }) => updateLesson(input.lessonId, input.updates)),
  
  publishLesson: publicProcedure
    .input(lessonIdInputSchema)
    .mutation(({ input }) => publishLesson(input.lessonId)),
  
  deleteLesson: publicProcedure
    .input(lessonIdInputSchema)
    .mutation(({ input }) => deleteLesson(input.lessonId)),
  
  reorderLessons: publicProcedure
    .input(lessonReorderInputSchema)
    .mutation(({ input }) => reorderLessons(input.courseId, input.lessonOrders)),

  // Quiz management routes
  createQuiz: publicProcedure
    .input(createQuizInputSchema)
    .mutation(({ input }) => createQuiz(input)),
  
  createQuizQuestion: publicProcedure
    .input(createQuizQuestionInputSchema)
    .mutation(({ input }) => createQuizQuestion(input)),
  
  getQuiz: publicProcedure
    .input(quizIdInputSchema)
    .query(({ input }) => getQuizById(input.quizId)),
  
  getQuizQuestions: publicProcedure
    .input(quizQuestionsInputSchema)
    .query(({ input }) => getQuizQuestions(input.quizId, input.includeAnswers)),
  
  submitQuiz: publicProcedure
    .input(submitQuizInputSchema)
    .mutation(({ input }) => submitQuiz(input, 1)), // TODO: Extract student ID from auth
  
  getQuizAttempts: publicProcedure
    .input(quizIdInputSchema)
    .query(({ input }) => getQuizAttempts(input.quizId, 1)), // TODO: Extract student ID
  
  getQuizAttempt: publicProcedure
    .input(attemptIdInputSchema)
    .query(({ input }) => getStudentQuizAttempt(input.attemptId, 1)), // TODO: Extract student ID
  
  updateQuiz: publicProcedure
    .input(quizUpdateInputSchema)
    .mutation(({ input }) => updateQuiz(input.quizId, input.updates)),
  
  deleteQuiz: publicProcedure
    .input(quizIdInputSchema)
    .mutation(({ input }) => deleteQuiz(input.quizId)),

  // Enrollment and progress routes
  enrollInCourse: publicProcedure
    .input(enrollInputSchema)
    .mutation(({ input }) => enrollInCourse(input, 1)), // TODO: Extract student ID
  
  getStudentEnrollments: publicProcedure
    .query(() => getStudentEnrollments(1)), // TODO: Extract student ID
  
  getCourseEnrollments: publicProcedure
    .input(courseIdInputSchema)
    .query(({ input }) => getCourseEnrollments(input.courseId)),
  
  updateProgress: publicProcedure
    .input(updateProgressInputSchema)
    .mutation(({ input }) => updateLessonProgress(input, 1)), // TODO: Extract student ID
  
  getStudentProgress: publicProcedure
    .input(courseIdInputSchema)
    .query(({ input }) => getStudentProgress(1, input.courseId)), // TODO: Extract student ID
  
  completeCourse: publicProcedure
    .input(courseIdInputSchema)
    .mutation(({ input }) => completeCourse(1, input.courseId)), // TODO: Extract student ID
  
  unenrollFromCourse: publicProcedure
    .input(courseIdInputSchema)
    .mutation(({ input }) => unenrollFromCourse(1, input.courseId)), // TODO: Extract student ID

  // Certificate routes
  generateCertificate: publicProcedure
    .input(courseIdInputSchema)
    .mutation(({ input }) => generateCertificate(1, input.courseId)), // TODO: Extract student ID
  
  getStudentCertificates: publicProcedure
    .query(() => getStudentCertificates(1)), // TODO: Extract student ID
  
  getCertificateByCode: publicProcedure
    .input(certificateCodeInputSchema)
    .query(({ input }) => getCertificateByCode(input.certificateCode)),
  
  getCertificate: publicProcedure
    .input(certificateIdInputSchema)
    .query(({ input }) => getCertificateById(input.certificateId)),
  
  regenerateCertificate: publicProcedure
    .input(certificateIdInputSchema)
    .mutation(({ input }) => regenerateCertificate(input.certificateId)),
  
  getCourseCompletionStats: publicProcedure
    .input(courseIdInputSchema)
    .query(({ input }) => getCourseCompletionStats(input.courseId)),

  // Payment routes
  createPayment: publicProcedure
    .input(createPaymentInputSchema)
    .mutation(({ input }) => createPayment(input, 1)), // TODO: Extract user ID
  
  processPayment: publicProcedure
    .input(processPaymentInputSchema)
    .mutation(({ input }) => processPayment(input.paymentId, input.transactionId)),
  
  getUserPayments: publicProcedure
    .query(() => getUserPayments(1)), // TODO: Extract user ID
  
  refundPayment: publicProcedure
    .input(refundPaymentInputSchema)
    .mutation(({ input }) => refundPayment(input.paymentId, input.reason)),
  
  createCoupon: publicProcedure
    .input(createCouponInputSchema)
    .mutation(({ input }) => createCoupon(input)),
  
  validateCoupon: publicProcedure
    .input(couponCodeInputSchema)
    .query(({ input }) => validateCoupon(input.couponCode, input.courseId)),
  
  getCoupons: publicProcedure
    .query(() => getCoupons()),
  
  deactivateCoupon: publicProcedure
    .input(couponIdInputSchema)
    .mutation(({ input }) => deactivateCoupon(input.couponId)),

  // Messaging routes
  sendMessage: publicProcedure
    .input(sendMessageInputSchema)
    .mutation(({ input }) => sendMessage(input, 1)), // TODO: Extract sender ID
  
  getUserMessages: publicProcedure
    .input(messageTypeInputSchema)
    .query(({ input }) => getUserMessages(1, input.type)), // TODO: Extract user ID
  
  getMessage: publicProcedure
    .input(messageIdInputSchema)
    .query(({ input }) => getMessageById(input.messageId, 1)), // TODO: Extract user ID
  
  markMessageAsRead: publicProcedure
    .input(messageIdInputSchema)
    .mutation(({ input }) => markMessageAsRead(input.messageId, 1)), // TODO: Extract user ID
  
  deleteMessage: publicProcedure
    .input(messageIdInputSchema)
    .mutation(({ input }) => deleteMessage(input.messageId, 1)), // TODO: Extract user ID

  // Notification routes
  createNotification: publicProcedure
    .input(createNotificationInputSchema)
    .mutation(({ input }) => createNotification(input)),
  
  getUserNotifications: publicProcedure
    .query(() => getUserNotifications(1)), // TODO: Extract user ID
  
  markNotificationAsRead: publicProcedure
    .input(notificationIdInputSchema)
    .mutation(({ input }) => markNotificationAsRead(input.notificationId, 1)), // TODO: Extract user ID
  
  markAllNotificationsAsRead: publicProcedure
    .mutation(() => markAllNotificationsAsRead(1)), // TODO: Extract user ID

  // Admin routes
  getAllUsers: publicProcedure
    .query(() => getAllUsers(1)), // TODO: Extract admin ID and validate permissions
  
  getUser: publicProcedure
    .input(userIdInputSchema)
    .query(({ input }) => getUserById(input.userId, 1)), // TODO: Extract admin ID
  
  updateUserStatus: publicProcedure
    .input(userStatusInputSchema)
    .mutation(({ input }) => updateUserStatus(input.userId, input.isActive, 1)), // TODO: Extract admin ID
  
  deleteUser: publicProcedure
    .input(userIdInputSchema)
    .mutation(({ input }) => deleteUser(input.userId, 1)), // TODO: Extract admin ID
  
  getAllCoursesAdmin: publicProcedure
    .query(() => getAllCourses(1)), // TODO: Extract admin ID
  
  moderateCourse: publicProcedure
    .input(courseModerationInputSchema)
    .mutation(({ input }) => moderateCourse(input.courseId, input.action, 1)), // TODO: Extract admin ID
  
  getSystemAnalytics: publicProcedure
    .query(() => getSystemAnalytics(1)), // TODO: Extract admin ID
  
  getRevenueReport: publicProcedure
    .input(dateRangeInputSchema)
    .query(({ input }) => getRevenueReport(1, input.startDate, input.endDate)), // TODO: Extract admin ID
  
  getCertificateStats: publicProcedure
    .query(() => getCertificateStats(1)), // TODO: Extract admin ID
  
  exportUserData: publicProcedure
    .input(exportFormatInputSchema)
    .mutation(({ input }) => exportUserData(1, input.format)), // TODO: Extract admin ID
  
  exportCourseData: publicProcedure
    .input(exportFormatInputSchema)
    .mutation(({ input }) => exportCourseData(1, input.format)) // TODO: Extract admin ID
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();