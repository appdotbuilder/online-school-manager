import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  enrollmentsTable, 
  usersTable, 
  coursesTable, 
  lessonsTable, 
  lessonProgressTable, 
  certificatesTable 
} from '../db/schema';
import { 
  enrollInCourse,
  getStudentEnrollments,
  getCourseEnrollments,
  updateLessonProgress,
  getStudentProgress,
  completeCourse,
  unenrollFromCourse
} from '../handlers/enrollments';
import { type EnrollInput, type UpdateProgressInput } from '../schema';
import { eq, and } from 'drizzle-orm';

describe('Enrollments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  let studentId: number;
  let instructorId: number;
  let courseId: number;
  let lessonId: number;

  const setupTestData = async () => {
    // Create student user
    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Student',
        role: 'student',
        is_active: true,
        email_verified: true
      })
      .returning()
      .execute();
    studentId = studentResult[0].id;

    // Create instructor user
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'Instructor',
        role: 'instructor',
        is_active: true,
        email_verified: true
      })
      .returning()
      .execute();
    instructorId = instructorResult[0].id;

    // Create course
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A test course',
        price: '99.99',
        instructor_id: instructorId,
        is_published: true,
        duration_hours: '10.5'
      })
      .returning()
      .execute();
    courseId = courseResult[0].id;

    // Create lesson
    const lessonResult = await db.insert(lessonsTable)
      .values({
        course_id: courseId,
        title: 'Test Lesson',
        description: 'A test lesson',
        order_index: 1,
        duration_minutes: 30,
        is_published: true
      })
      .returning()
      .execute();
    lessonId = lessonResult[0].id;
  };

  describe('enrollInCourse', () => {
    it('should successfully enroll a student in a course', async () => {
      await setupTestData();
      
      const input: EnrollInput = {
        course_id: courseId
      };

      const result = await enrollInCourse(input, studentId);

      expect(result.student_id).toEqual(studentId);
      expect(result.course_id).toEqual(courseId);
      expect(result.progress_percentage).toEqual(0);
      expect(result.is_completed).toEqual(false);
      expect(result.id).toBeDefined();
      expect(result.enrollment_date).toBeInstanceOf(Date);
      expect(result.completion_date).toBeNull();
    });

    it('should save enrollment to database', async () => {
      await setupTestData();
      
      const input: EnrollInput = {
        course_id: courseId
      };

      const result = await enrollInCourse(input, studentId);

      const enrollments = await db.select()
        .from(enrollmentsTable)
        .where(eq(enrollmentsTable.id, result.id))
        .execute();

      expect(enrollments).toHaveLength(1);
      expect(enrollments[0].student_id).toEqual(studentId);
      expect(enrollments[0].course_id).toEqual(courseId);
    });

    it('should throw error if student does not exist', async () => {
      await setupTestData();
      
      const input: EnrollInput = {
        course_id: courseId
      };

      await expect(enrollInCourse(input, 99999)).rejects.toThrow(/student not found/i);
    });

    it('should throw error if course does not exist', async () => {
      await setupTestData();
      
      const input: EnrollInput = {
        course_id: 99999
      };

      await expect(enrollInCourse(input, studentId)).rejects.toThrow(/course not found/i);
    });

    it('should throw error if student is already enrolled', async () => {
      await setupTestData();
      
      const input: EnrollInput = {
        course_id: courseId
      };

      // First enrollment
      await enrollInCourse(input, studentId);

      // Second enrollment should fail
      await expect(enrollInCourse(input, studentId)).rejects.toThrow(/already enrolled/i);
    });

    it('should throw error if user is not a student', async () => {
      await setupTestData();
      
      const input: EnrollInput = {
        course_id: courseId
      };

      await expect(enrollInCourse(input, instructorId)).rejects.toThrow(/student not found or invalid role/i);
    });
  });

  describe('getStudentEnrollments', () => {
    it('should return empty array when student has no enrollments', async () => {
      await setupTestData();

      const result = await getStudentEnrollments(studentId);

      expect(result).toEqual([]);
    });

    it('should return student enrollments', async () => {
      await setupTestData();

      // Create enrollment
      await enrollInCourse({ course_id: courseId }, studentId);

      const result = await getStudentEnrollments(studentId);

      expect(result).toHaveLength(1);
      expect(result[0].student_id).toEqual(studentId);
      expect(result[0].course_id).toEqual(courseId);
    });

    it('should throw error if student does not exist', async () => {
      await setupTestData();

      await expect(getStudentEnrollments(99999)).rejects.toThrow(/student not found/i);
    });
  });

  describe('getCourseEnrollments', () => {
    it('should return empty array when course has no enrollments', async () => {
      await setupTestData();

      const result = await getCourseEnrollments(courseId);

      expect(result).toEqual([]);
    });

    it('should return course enrollments', async () => {
      await setupTestData();

      // Create enrollment
      await enrollInCourse({ course_id: courseId }, studentId);

      const result = await getCourseEnrollments(courseId);

      expect(result).toHaveLength(1);
      expect(result[0].student_id).toEqual(studentId);
      expect(result[0].course_id).toEqual(courseId);
    });

    it('should throw error if course does not exist', async () => {
      await setupTestData();

      await expect(getCourseEnrollments(99999)).rejects.toThrow(/course not found/i);
    });
  });

  describe('updateLessonProgress', () => {
    it('should create new lesson progress record', async () => {
      await setupTestData();
      
      // Enroll student first
      await enrollInCourse({ course_id: courseId }, studentId);

      const input: UpdateProgressInput = {
        lesson_id: lessonId,
        watch_time_seconds: 300,
        is_completed: false
      };

      const result = await updateLessonProgress(input, studentId);

      expect(result.student_id).toEqual(studentId);
      expect(result.lesson_id).toEqual(lessonId);
      expect(result.watch_time_seconds).toEqual(300);
      expect(result.is_completed).toEqual(false);
      expect(result.completed_at).toBeNull();
      expect(result.last_accessed_at).toBeInstanceOf(Date);
    });

    it('should update existing lesson progress record', async () => {
      await setupTestData();
      
      // Enroll student first
      await enrollInCourse({ course_id: courseId }, studentId);

      // Create initial progress
      await updateLessonProgress({
        lesson_id: lessonId,
        watch_time_seconds: 300,
        is_completed: false
      }, studentId);

      // Update progress
      const updateInput: UpdateProgressInput = {
        lesson_id: lessonId,
        watch_time_seconds: 600,
        is_completed: true
      };

      const result = await updateLessonProgress(updateInput, studentId);

      expect(result.watch_time_seconds).toEqual(600);
      expect(result.is_completed).toEqual(true);
      expect(result.completed_at).toBeInstanceOf(Date);
    });

    it('should throw error if lesson does not exist', async () => {
      await setupTestData();
      
      // Enroll student first
      await enrollInCourse({ course_id: courseId }, studentId);

      const input: UpdateProgressInput = {
        lesson_id: 99999,
        watch_time_seconds: 300
      };

      await expect(updateLessonProgress(input, studentId)).rejects.toThrow(/lesson not found or student not enrolled/i);
    });

    it('should throw error if student is not enrolled in course', async () => {
      await setupTestData();

      const input: UpdateProgressInput = {
        lesson_id: lessonId,
        watch_time_seconds: 300
      };

      await expect(updateLessonProgress(input, studentId)).rejects.toThrow(/lesson not found or student not enrolled/i);
    });
  });

  describe('getStudentProgress', () => {
    it('should return student progress with no lesson progress initially', async () => {
      await setupTestData();
      
      // Enroll student first
      await enrollInCourse({ course_id: courseId }, studentId);

      const result = await getStudentProgress(studentId, courseId);

      expect(result.enrollment.student_id).toEqual(studentId);
      expect(result.enrollment.course_id).toEqual(courseId);
      expect(result.lessonProgress).toEqual([]);
      expect(result.completedLessons).toEqual(0);
      expect(result.totalLessons).toEqual(1);
    });

    it('should return student progress with lesson progress', async () => {
      await setupTestData();
      
      // Enroll student first
      await enrollInCourse({ course_id: courseId }, studentId);

      // Add lesson progress
      await updateLessonProgress({
        lesson_id: lessonId,
        watch_time_seconds: 300,
        is_completed: true
      }, studentId);

      const result = await getStudentProgress(studentId, courseId);

      expect(result.enrollment.student_id).toEqual(studentId);
      expect(result.lessonProgress).toHaveLength(1);
      expect(result.lessonProgress[0].is_completed).toEqual(true);
      expect(result.completedLessons).toEqual(1);
      expect(result.totalLessons).toEqual(1);
    });

    it('should throw error if enrollment does not exist', async () => {
      await setupTestData();

      await expect(getStudentProgress(studentId, courseId)).rejects.toThrow(/enrollment not found/i);
    });
  });

  describe('completeCourse', () => {
    it('should mark course as completed and create certificate', async () => {
      await setupTestData();
      
      // Enroll student first
      await enrollInCourse({ course_id: courseId }, studentId);

      const result = await completeCourse(studentId, courseId);

      expect(result.is_completed).toEqual(true);
      expect(result.progress_percentage).toEqual(100);
      expect(result.completion_date).toBeInstanceOf(Date);

      // Check certificate was created
      const certificates = await db.select()
        .from(certificatesTable)
        .where(and(
          eq(certificatesTable.student_id, studentId),
          eq(certificatesTable.course_id, courseId)
        ))
        .execute();

      expect(certificates).toHaveLength(1);
      expect(certificates[0].certificate_code).toMatch(/^CERT-/);
    });

    it('should throw error if enrollment does not exist', async () => {
      await setupTestData();

      await expect(completeCourse(studentId, courseId)).rejects.toThrow(/enrollment not found/i);
    });
  });

  describe('unenrollFromCourse', () => {
    it('should successfully unenroll student from course', async () => {
      await setupTestData();
      
      // Enroll student first
      await enrollInCourse({ course_id: courseId }, studentId);

      // Add some progress
      await updateLessonProgress({
        lesson_id: lessonId,
        watch_time_seconds: 300,
        is_completed: false
      }, studentId);

      const result = await unenrollFromCourse(studentId, courseId);

      expect(result.success).toEqual(true);

      // Verify enrollment is deleted
      const enrollments = await db.select()
        .from(enrollmentsTable)
        .where(and(
          eq(enrollmentsTable.student_id, studentId),
          eq(enrollmentsTable.course_id, courseId)
        ))
        .execute();

      expect(enrollments).toHaveLength(0);

      // Verify lesson progress is deleted
      const progress = await db.select()
        .from(lessonProgressTable)
        .where(eq(lessonProgressTable.student_id, studentId))
        .execute();

      expect(progress).toHaveLength(0);
    });

    it('should throw error if enrollment does not exist', async () => {
      await setupTestData();

      await expect(unenrollFromCourse(studentId, courseId)).rejects.toThrow(/enrollment not found/i);
    });
  });

  describe('progress calculation', () => {
    it('should update enrollment progress when lesson is completed', async () => {
      await setupTestData();
      
      // Create another lesson
      const lesson2Result = await db.insert(lessonsTable)
        .values({
          course_id: courseId,
          title: 'Test Lesson 2',
          description: 'Another test lesson',
          order_index: 2,
          duration_minutes: 45,
          is_published: true
        })
        .returning()
        .execute();
      const lesson2Id = lesson2Result[0].id;

      // Enroll student
      await enrollInCourse({ course_id: courseId }, studentId);

      // Complete first lesson
      await updateLessonProgress({
        lesson_id: lessonId,
        watch_time_seconds: 1800,
        is_completed: true
      }, studentId);

      // Check progress is 50%
      let enrollment = await db.select()
        .from(enrollmentsTable)
        .where(and(
          eq(enrollmentsTable.student_id, studentId),
          eq(enrollmentsTable.course_id, courseId)
        ))
        .execute();

      expect(enrollment[0].progress_percentage).toEqual(50);
      expect(enrollment[0].is_completed).toEqual(false);

      // Complete second lesson
      await updateLessonProgress({
        lesson_id: lesson2Id,
        watch_time_seconds: 2700,
        is_completed: true
      }, studentId);

      // Check progress is 100% and course is completed
      enrollment = await db.select()
        .from(enrollmentsTable)
        .where(and(
          eq(enrollmentsTable.student_id, studentId),
          eq(enrollmentsTable.course_id, courseId)
        ))
        .execute();

      expect(enrollment[0].progress_percentage).toEqual(100);
      expect(enrollment[0].is_completed).toEqual(true);
      expect(enrollment[0].completion_date).toBeInstanceOf(Date);
    });
  });
});