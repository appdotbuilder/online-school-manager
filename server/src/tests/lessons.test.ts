import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { coursesTable, lessonsTable, usersTable } from '../db/schema';
import { type CreateLessonInput } from '../schema';
import { createLesson } from '../handlers/lessons';
import { eq } from 'drizzle-orm';

// Create test instructor user first
const createTestInstructor = async () => {
  const instructorResult = await db.insert(usersTable)
    .values({
      email: 'instructor@example.com',
      password_hash: 'hashed_password',
      first_name: 'John',
      last_name: 'Doe',
      role: 'instructor'
    })
    .returning()
    .execute();
  return instructorResult[0];
};

// Create test course
const createTestCourse = async (instructorId: number) => {
  const courseResult = await db.insert(coursesTable)
    .values({
      title: 'Test Course',
      description: 'A course for testing',
      price: '99.99',
      instructor_id: instructorId,
      duration_hours: '10.5'
    })
    .returning()
    .execute();
  return courseResult[0];
};

// Test input with all required fields
const testInput: CreateLessonInput = {
  course_id: 1, // Will be updated in tests with actual course ID
  title: 'Introduction to Testing',
  description: 'Learn the basics of testing',
  video_url: 'https://example.com/video.mp4',
  content: 'This lesson covers fundamental testing concepts.',
  order_index: 1,
  duration_minutes: 45
};

describe('createLesson', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a lesson successfully', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);
    
    const input = { ...testInput, course_id: course.id };
    const result = await createLesson(input);

    // Verify all fields are correctly set
    expect(result.id).toBeDefined();
    expect(result.course_id).toEqual(course.id);
    expect(result.title).toEqual('Introduction to Testing');
    expect(result.description).toEqual('Learn the basics of testing');
    expect(result.video_url).toEqual('https://example.com/video.mp4');
    expect(result.content).toEqual('This lesson covers fundamental testing concepts.');
    expect(result.order_index).toEqual(1);
    expect(result.duration_minutes).toEqual(45);
    expect(result.is_published).toEqual(false); // Default value
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save lesson to database', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);
    
    const input = { ...testInput, course_id: course.id };
    const result = await createLesson(input);

    // Query database to verify lesson was saved
    const lessons = await db.select()
      .from(lessonsTable)
      .where(eq(lessonsTable.id, result.id))
      .execute();

    expect(lessons).toHaveLength(1);
    const savedLesson = lessons[0];
    expect(savedLesson.course_id).toEqual(course.id);
    expect(savedLesson.title).toEqual('Introduction to Testing');
    expect(savedLesson.description).toEqual('Learn the basics of testing');
    expect(savedLesson.video_url).toEqual('https://example.com/video.mp4');
    expect(savedLesson.content).toEqual('This lesson covers fundamental testing concepts.');
    expect(savedLesson.order_index).toEqual(1);
    expect(savedLesson.duration_minutes).toEqual(45);
    expect(savedLesson.is_published).toEqual(false);
  });

  it('should handle lesson with null optional fields', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);
    
    const minimalInput: CreateLessonInput = {
      course_id: course.id,
      title: 'Minimal Lesson',
      description: null,
      video_url: null,
      content: null,
      order_index: 2,
      duration_minutes: 30
    };

    const result = await createLesson(minimalInput);

    expect(result.title).toEqual('Minimal Lesson');
    expect(result.description).toBeNull();
    expect(result.video_url).toBeNull();
    expect(result.content).toBeNull();
    expect(result.order_index).toEqual(2);
    expect(result.duration_minutes).toEqual(30);
  });

  it('should throw error when course does not exist', async () => {
    const input = { ...testInput, course_id: 999999 }; // Non-existent course ID

    await expect(createLesson(input)).rejects.toThrow(/Course not found/i);
  });

  it('should create multiple lessons for the same course', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);
    
    // Create first lesson
    const input1 = { ...testInput, course_id: course.id, title: 'Lesson 1', order_index: 1 };
    const result1 = await createLesson(input1);

    // Create second lesson
    const input2 = { ...testInput, course_id: course.id, title: 'Lesson 2', order_index: 2 };
    const result2 = await createLesson(input2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.title).toEqual('Lesson 1');
    expect(result2.title).toEqual('Lesson 2');

    // Verify both lessons exist in database
    const lessons = await db.select()
      .from(lessonsTable)
      .where(eq(lessonsTable.course_id, course.id))
      .execute();

    expect(lessons).toHaveLength(2);
  });

  it('should handle lessons with different content types', async () => {
    const instructor = await createTestInstructor();
    const course = await createTestCourse(instructor.id);
    
    // Video-based lesson
    const videoLessonInput = {
      course_id: course.id,
      title: 'Video Lesson',
      description: 'A lesson with video content',
      video_url: 'https://example.com/lesson-video.mp4',
      content: null,
      order_index: 1,
      duration_minutes: 60
    };

    // Text-based lesson
    const textLessonInput = {
      course_id: course.id,
      title: 'Text Lesson',
      description: 'A lesson with text content',
      video_url: null,
      content: 'Detailed written lesson content goes here...',
      order_index: 2,
      duration_minutes: 30
    };

    const videoResult = await createLesson(videoLessonInput);
    const textResult = await createLesson(textLessonInput);

    expect(videoResult.video_url).toEqual('https://example.com/lesson-video.mp4');
    expect(videoResult.content).toBeNull();
    expect(textResult.video_url).toBeNull();
    expect(textResult.content).toEqual('Detailed written lesson content goes here...');
  });
});