import { db } from '../db';
import { coursesTable, usersTable, lessonsTable, quizzesTable } from '../db/schema';
import { type CreateCourseInput, type Course } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export async function createCourse(input: CreateCourseInput, instructorId: number): Promise<Course> {
  try {
    // Verify instructor exists and has correct role
    const instructor = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, instructorId))
      .execute();

    if (!instructor.length) {
      throw new Error('Instructor not found');
    }

    if (instructor[0].role !== 'instructor' && instructor[0].role !== 'administrator') {
      throw new Error('User does not have permission to create courses');
    }

    // Create course
    const result = await db.insert(coursesTable)
      .values({
        title: input.title,
        description: input.description,
        thumbnail_url: input.thumbnail_url,
        price: input.price.toString(), // Convert number to string for numeric column
        instructor_id: instructorId,
        is_published: false, // New courses start unpublished
        duration_hours: input.duration_hours.toString() // Convert number to string for numeric column
      })
      .returning()
      .execute();

    const course = result[0];
    return {
      ...course,
      price: parseFloat(course.price), // Convert string back to number
      duration_hours: parseFloat(course.duration_hours) // Convert string back to number
    };
  } catch (error) {
    console.error('Course creation failed:', error);
    throw error;
  }
}

export async function getCourses(): Promise<Course[]> {
  try {
    const result = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.is_published, true))
      .execute();

    return result.map(course => ({
      ...course,
      price: parseFloat(course.price), // Convert string back to number
      duration_hours: parseFloat(course.duration_hours) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch courses:', error);
    throw error;
  }
}

export async function getCourseById(courseId: number): Promise<Course | null> {
  try {
    const result = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .execute();

    if (!result.length) {
      return null;
    }

    const course = result[0];
    return {
      ...course,
      price: parseFloat(course.price), // Convert string back to number
      duration_hours: parseFloat(course.duration_hours) // Convert string back to number
    };
  } catch (error) {
    console.error('Failed to fetch course by ID:', error);
    throw error;
  }
}

export async function getInstructorCourses(instructorId: number): Promise<Course[]> {
  try {
    // Verify instructor exists
    const instructor = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, instructorId))
      .execute();

    if (!instructor.length) {
      throw new Error('Instructor not found');
    }

    const result = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.instructor_id, instructorId))
      .execute();

    return result.map(course => ({
      ...course,
      price: parseFloat(course.price), // Convert string back to number
      duration_hours: parseFloat(course.duration_hours) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch instructor courses:', error);
    throw error;
  }
}

export async function updateCourse(courseId: number, updates: Partial<CreateCourseInput>, instructorId: number): Promise<Course> {
  try {
    // Verify course exists and instructor owns it
    const existingCourse = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .execute();

    if (!existingCourse.length) {
      throw new Error('Course not found');
    }

    if (existingCourse[0].instructor_id !== instructorId) {
      throw new Error('You do not have permission to update this course');
    }

    // Build update values, converting numbers to strings for numeric columns
    const updateValues: any = {};
    if (updates.title !== undefined) updateValues.title = updates.title;
    if (updates.description !== undefined) updateValues.description = updates.description;
    if (updates.thumbnail_url !== undefined) updateValues.thumbnail_url = updates.thumbnail_url;
    if (updates.price !== undefined) updateValues.price = updates.price.toString();
    if (updates.duration_hours !== undefined) updateValues.duration_hours = updates.duration_hours.toString();
    
    // Always update the updated_at timestamp
    updateValues.updated_at = new Date();

    const result = await db.update(coursesTable)
      .set(updateValues)
      .where(eq(coursesTable.id, courseId))
      .returning()
      .execute();

    const course = result[0];
    return {
      ...course,
      price: parseFloat(course.price), // Convert string back to number
      duration_hours: parseFloat(course.duration_hours) // Convert string back to number
    };
  } catch (error) {
    console.error('Course update failed:', error);
    throw error;
  }
}

export async function publishCourse(courseId: number, instructorId: number): Promise<Course> {
  try {
    // Verify course exists and instructor owns it
    const existingCourse = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .execute();

    if (!existingCourse.length) {
      throw new Error('Course not found');
    }

    if (existingCourse[0].instructor_id !== instructorId) {
      throw new Error('You do not have permission to publish this course');
    }

    // Validate course has required content before publishing
    const lessons = await db.select()
      .from(lessonsTable)
      .where(eq(lessonsTable.course_id, courseId))
      .execute();

    if (lessons.length === 0) {
      throw new Error('Course must have at least one lesson before publishing');
    }

    // Update course to published
    const result = await db.update(coursesTable)
      .set({ 
        is_published: true,
        updated_at: new Date()
      })
      .where(eq(coursesTable.id, courseId))
      .returning()
      .execute();

    const course = result[0];
    return {
      ...course,
      price: parseFloat(course.price), // Convert string back to number
      duration_hours: parseFloat(course.duration_hours) // Convert string back to number
    };
  } catch (error) {
    console.error('Course publishing failed:', error);
    throw error;
  }
}

export async function deleteCourse(courseId: number, instructorId: number): Promise<{ success: boolean }> {
  try {
    // Verify course exists and instructor owns it
    const existingCourse = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .execute();

    if (!existingCourse.length) {
      throw new Error('Course not found');
    }

    if (existingCourse[0].instructor_id !== instructorId) {
      throw new Error('You do not have permission to delete this course');
    }

    // Delete the course (CASCADE will handle related data)
    await db.delete(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Course deletion failed:', error);
    throw error;
  }
}