import { db } from '../db';
import { 
  enrollmentsTable, 
  lessonsTable, 
  lessonProgressTable, 
  coursesTable, 
  usersTable, 
  certificatesTable 
} from '../db/schema';
import { type EnrollInput, type Enrollment, type UpdateProgressInput, type LessonProgress } from '../schema';
import { eq, and, count, SQL } from 'drizzle-orm';

export async function enrollInCourse(input: EnrollInput, studentId: number): Promise<Enrollment> {
  try {
    // Validate that student exists and is a student
    const student = await db.select()
      .from(usersTable)
      .where(and(eq(usersTable.id, studentId), eq(usersTable.role, 'student')))
      .execute();

    if (student.length === 0) {
      throw new Error('Student not found or invalid role');
    }

    // Validate that course exists
    const course = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, input.course_id))
      .execute();

    if (course.length === 0) {
      throw new Error('Course not found');
    }

    // Check if already enrolled
    const existingEnrollment = await db.select()
      .from(enrollmentsTable)
      .where(and(
        eq(enrollmentsTable.student_id, studentId),
        eq(enrollmentsTable.course_id, input.course_id)
      ))
      .execute();

    if (existingEnrollment.length > 0) {
      throw new Error('Student already enrolled in this course');
    }

    // Create enrollment record
    const result = await db.insert(enrollmentsTable)
      .values({
        student_id: studentId,
        course_id: input.course_id,
        progress_percentage: 0,
        is_completed: false
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Enrollment failed:', error);
    throw error;
  }
}

export async function getStudentEnrollments(studentId: number): Promise<Enrollment[]> {
  try {
    // Validate that student exists
    const student = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, studentId))
      .execute();

    if (student.length === 0) {
      throw new Error('Student not found');
    }

    const enrollments = await db.select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.student_id, studentId))
      .execute();

    return enrollments;
  } catch (error) {
    console.error('Failed to get student enrollments:', error);
    throw error;
  }
}

export async function getCourseEnrollments(courseId: number): Promise<Enrollment[]> {
  try {
    // Validate that course exists
    const course = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .execute();

    if (course.length === 0) {
      throw new Error('Course not found');
    }

    const enrollments = await db.select()
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.course_id, courseId))
      .execute();

    return enrollments;
  } catch (error) {
    console.error('Failed to get course enrollments:', error);
    throw error;
  }
}

export async function updateLessonProgress(input: UpdateProgressInput, studentId: number): Promise<LessonProgress> {
  try {
    // Validate that lesson exists and student is enrolled in the course
    const lessonData = await db.select({
      lesson: lessonsTable,
      enrollment: enrollmentsTable
    })
      .from(lessonsTable)
      .innerJoin(enrollmentsTable, 
        and(
          eq(enrollmentsTable.course_id, lessonsTable.course_id),
          eq(enrollmentsTable.student_id, studentId)
        )
      )
      .where(eq(lessonsTable.id, input.lesson_id))
      .execute();

    if (lessonData.length === 0) {
      throw new Error('Lesson not found or student not enrolled in course');
    }

    // Check if progress record already exists
    const existingProgress = await db.select()
      .from(lessonProgressTable)
      .where(and(
        eq(lessonProgressTable.student_id, studentId),
        eq(lessonProgressTable.lesson_id, input.lesson_id)
      ))
      .execute();

    let progressResult;

    if (existingProgress.length > 0) {
      // Update existing progress
      const updateData: any = {
        watch_time_seconds: input.watch_time_seconds,
        last_accessed_at: new Date()
      };

      if (input.is_completed !== undefined) {
        updateData.is_completed = input.is_completed;
        if (input.is_completed) {
          updateData.completed_at = new Date();
        }
      }

      progressResult = await db.update(lessonProgressTable)
        .set(updateData)
        .where(and(
          eq(lessonProgressTable.student_id, studentId),
          eq(lessonProgressTable.lesson_id, input.lesson_id)
        ))
        .returning()
        .execute();
    } else {
      // Create new progress record
      progressResult = await db.insert(lessonProgressTable)
        .values({
          student_id: studentId,
          lesson_id: input.lesson_id,
          is_completed: input.is_completed || false,
          watch_time_seconds: input.watch_time_seconds,
          completed_at: input.is_completed ? new Date() : null,
          last_accessed_at: new Date()
        })
        .returning()
        .execute();
    }

    // Update enrollment progress percentage
    await updateEnrollmentProgress(studentId, lessonData[0].lesson.course_id);

    return progressResult[0];
  } catch (error) {
    console.error('Failed to update lesson progress:', error);
    throw error;
  }
}

export async function getStudentProgress(studentId: number, courseId: number): Promise<{
  enrollment: Enrollment;
  lessonProgress: LessonProgress[];
  completedLessons: number;
  totalLessons: number;
}> {
  try {
    // Get enrollment
    const enrollment = await db.select()
      .from(enrollmentsTable)
      .where(and(
        eq(enrollmentsTable.student_id, studentId),
        eq(enrollmentsTable.course_id, courseId)
      ))
      .execute();

    if (enrollment.length === 0) {
      throw new Error('Enrollment not found');
    }

    // Get all lesson progress for the course
    const lessonProgress = await db.select({
      progress: lessonProgressTable,
      lesson: lessonsTable
    })
      .from(lessonProgressTable)
      .innerJoin(lessonsTable, eq(lessonProgressTable.lesson_id, lessonsTable.id))
      .where(and(
        eq(lessonProgressTable.student_id, studentId),
        eq(lessonsTable.course_id, courseId)
      ))
      .execute();

    // Get total lessons count for the course
    const totalLessonsResult = await db.select({
      count: count()
    })
      .from(lessonsTable)
      .where(eq(lessonsTable.course_id, courseId))
      .execute();

    const totalLessons = totalLessonsResult[0].count;
    const completedLessons = lessonProgress.filter(lp => lp.progress.is_completed).length;

    return {
      enrollment: enrollment[0],
      lessonProgress: lessonProgress.map(lp => lp.progress),
      completedLessons,
      totalLessons
    };
  } catch (error) {
    console.error('Failed to get student progress:', error);
    throw error;
  }
}

export async function completeCourse(studentId: number, courseId: number): Promise<Enrollment> {
  try {
    // Validate enrollment exists
    const enrollment = await db.select()
      .from(enrollmentsTable)
      .where(and(
        eq(enrollmentsTable.student_id, studentId),
        eq(enrollmentsTable.course_id, courseId)
      ))
      .execute();

    if (enrollment.length === 0) {
      throw new Error('Enrollment not found');
    }

    // Update enrollment to completed
    const result = await db.update(enrollmentsTable)
      .set({
        is_completed: true,
        completion_date: new Date(),
        progress_percentage: 100
      })
      .where(and(
        eq(enrollmentsTable.student_id, studentId),
        eq(enrollmentsTable.course_id, courseId)
      ))
      .returning()
      .execute();

    // Generate certificate code (simple implementation)
    const certificateCode = `CERT-${courseId}-${studentId}-${Date.now()}`;

    // Create certificate record
    await db.insert(certificatesTable)
      .values({
        student_id: studentId,
        course_id: courseId,
        certificate_code: certificateCode
      })
      .execute();

    return result[0];
  } catch (error) {
    console.error('Failed to complete course:', error);
    throw error;
  }
}

export async function unenrollFromCourse(studentId: number, courseId: number): Promise<{ success: boolean }> {
  try {
    // Check if enrollment exists
    const enrollment = await db.select()
      .from(enrollmentsTable)
      .where(and(
        eq(enrollmentsTable.student_id, studentId),
        eq(enrollmentsTable.course_id, courseId)
      ))
      .execute();

    if (enrollment.length === 0) {
      throw new Error('Enrollment not found');
    }

    // Delete lesson progress records first (foreign key constraint)
    await db.delete(lessonProgressTable)
      .where(and(
        eq(lessonProgressTable.student_id, studentId),
        eq(lessonProgressTable.lesson_id, 
          db.select({ id: lessonsTable.id })
            .from(lessonsTable)
            .where(eq(lessonsTable.course_id, courseId)) as any
        )
      ))
      .execute();

    // Delete enrollment
    await db.delete(enrollmentsTable)
      .where(and(
        eq(enrollmentsTable.student_id, studentId),
        eq(enrollmentsTable.course_id, courseId)
      ))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Failed to unenroll from course:', error);
    throw error;
  }
}

// Helper function to update enrollment progress percentage
async function updateEnrollmentProgress(studentId: number, courseId: number): Promise<void> {
  try {
    // Get total lessons count
    const totalLessonsResult = await db.select({
      count: count()
    })
      .from(lessonsTable)
      .where(eq(lessonsTable.course_id, courseId))
      .execute();

    const totalLessons = totalLessonsResult[0].count;

    if (totalLessons === 0) {
      return; // No lessons, no progress to calculate
    }

    // Get completed lessons count
    const completedLessonsResult = await db.select({
      count: count()
    })
      .from(lessonProgressTable)
      .innerJoin(lessonsTable, eq(lessonProgressTable.lesson_id, lessonsTable.id))
      .where(and(
        eq(lessonProgressTable.student_id, studentId),
        eq(lessonProgressTable.is_completed, true),
        eq(lessonsTable.course_id, courseId)
      ))
      .execute();

    const completedLessons = completedLessonsResult[0].count;
    const progressPercentage = Math.round((completedLessons / totalLessons) * 100);

    // Update enrollment progress
    await db.update(enrollmentsTable)
      .set({
        progress_percentage: progressPercentage,
        is_completed: progressPercentage === 100,
        completion_date: progressPercentage === 100 ? new Date() : null
      })
      .where(and(
        eq(enrollmentsTable.student_id, studentId),
        eq(enrollmentsTable.course_id, courseId)
      ))
      .execute();
  } catch (error) {
    console.error('Failed to update enrollment progress:', error);
    // Don't throw here as this is a helper function
  }
}