import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { coursesTable, usersTable, lessonsTable } from '../db/schema';
import { type CreateCourseInput } from '../schema';
import { 
  createCourse, 
  getCourses, 
  getCourseById, 
  getInstructorCourses, 
  updateCourse, 
  publishCourse, 
  deleteCourse 
} from '../handlers/courses';
import { eq } from 'drizzle-orm';

// Test data
const testInstructor = {
  email: 'instructor@test.com',
  password_hash: 'hashedpassword',
  first_name: 'John',
  last_name: 'Doe',
  role: 'instructor' as const,
  is_active: true,
  email_verified: true
};

const testStudent = {
  email: 'student@test.com',
  password_hash: 'hashedpassword',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'student' as const,
  is_active: true,
  email_verified: true
};

const testCourseInput: CreateCourseInput = {
  title: 'Test Course',
  description: 'A comprehensive test course',
  thumbnail_url: 'https://example.com/thumbnail.jpg',
  price: 99.99,
  duration_hours: 10.5
};

describe('Course Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createCourse', () => {
    it('should create a course for valid instructor', async () => {
      // Create instructor
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const result = await createCourse(testCourseInput, instructorId);

      expect(result.title).toEqual('Test Course');
      expect(result.description).toEqual(testCourseInput.description);
      expect(result.thumbnail_url).toEqual(testCourseInput.thumbnail_url);
      expect(result.price).toEqual(99.99);
      expect(typeof result.price).toEqual('number');
      expect(result.duration_hours).toEqual(10.5);
      expect(typeof result.duration_hours).toEqual('number');
      expect(result.instructor_id).toEqual(instructorId);
      expect(result.is_published).toEqual(false);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save course to database', async () => {
      // Create instructor
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const result = await createCourse(testCourseInput, instructorId);

      // Verify in database
      const courses = await db.select()
        .from(coursesTable)
        .where(eq(coursesTable.id, result.id))
        .execute();

      expect(courses).toHaveLength(1);
      expect(courses[0].title).toEqual('Test Course');
      expect(parseFloat(courses[0].price)).toEqual(99.99);
      expect(parseFloat(courses[0].duration_hours)).toEqual(10.5);
      expect(courses[0].is_published).toEqual(false);
    });

    it('should throw error for non-existent instructor', async () => {
      await expect(createCourse(testCourseInput, 999))
        .rejects.toThrow(/instructor not found/i);
    });

    it('should throw error for non-instructor user', async () => {
      // Create student
      const studentResult = await db.insert(usersTable)
        .values(testStudent)
        .returning()
        .execute();
      const studentId = studentResult[0].id;

      await expect(createCourse(testCourseInput, studentId))
        .rejects.toThrow(/does not have permission/i);
    });

    it('should allow administrators to create courses', async () => {
      // Create administrator
      const adminResult = await db.insert(usersTable)
        .values({
          ...testInstructor,
          email: 'admin@test.com',
          role: 'administrator' as const
        })
        .returning()
        .execute();
      const adminId = adminResult[0].id;

      const result = await createCourse(testCourseInput, adminId);

      expect(result.title).toEqual('Test Course');
      expect(result.instructor_id).toEqual(adminId);
    });
  });

  describe('getCourses', () => {
    it('should return only published courses', async () => {
      // Create instructor
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      // Create published course
      await db.insert(coursesTable)
        .values({
          title: 'Published Course',
          description: 'Published course description',
          thumbnail_url: null,
          price: '49.99',
          instructor_id: instructorId,
          is_published: true,
          duration_hours: '5.0'
        })
        .execute();

      // Create unpublished course
      await db.insert(coursesTable)
        .values({
          title: 'Unpublished Course',
          description: 'Unpublished course description',
          thumbnail_url: null,
          price: '29.99',
          instructor_id: instructorId,
          is_published: false,
          duration_hours: '3.0'
        })
        .execute();

      const result = await getCourses();

      expect(result).toHaveLength(1);
      expect(result[0].title).toEqual('Published Course');
      expect(result[0].is_published).toEqual(true);
      expect(typeof result[0].price).toEqual('number');
      expect(result[0].price).toEqual(49.99);
    });

    it('should return empty array when no published courses exist', async () => {
      const result = await getCourses();
      expect(result).toHaveLength(0);
    });
  });

  describe('getCourseById', () => {
    it('should return course for valid ID', async () => {
      // Create instructor and course
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          title: 'Test Course',
          description: 'Test description',
          thumbnail_url: null,
          price: '99.99',
          instructor_id: instructorId,
          is_published: true,
          duration_hours: '10.5'
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      const result = await getCourseById(courseId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(courseId);
      expect(result!.title).toEqual('Test Course');
      expect(typeof result!.price).toEqual('number');
      expect(result!.price).toEqual(99.99);
    });

    it('should return null for non-existent course', async () => {
      const result = await getCourseById(999);
      expect(result).toBeNull();
    });
  });

  describe('getInstructorCourses', () => {
    it('should return all courses for instructor', async () => {
      // Create instructor
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      // Create published and unpublished courses
      await db.insert(coursesTable)
        .values([
          {
            title: 'Published Course',
            description: 'Published',
            thumbnail_url: null,
            price: '49.99',
            instructor_id: instructorId,
            is_published: true,
            duration_hours: '5.0'
          },
          {
            title: 'Unpublished Course',
            description: 'Unpublished',
            thumbnail_url: null,
            price: '29.99',
            instructor_id: instructorId,
            is_published: false,
            duration_hours: '3.0'
          }
        ])
        .execute();

      const result = await getInstructorCourses(instructorId);

      expect(result).toHaveLength(2);
      expect(result.find(c => c.title === 'Published Course')).toBeDefined();
      expect(result.find(c => c.title === 'Unpublished Course')).toBeDefined();
      
      // Verify numeric conversion
      result.forEach(course => {
        expect(typeof course.price).toEqual('number');
        expect(typeof course.duration_hours).toEqual('number');
      });
    });

    it('should throw error for non-existent instructor', async () => {
      await expect(getInstructorCourses(999))
        .rejects.toThrow(/instructor not found/i);
    });

    it('should return empty array for instructor with no courses', async () => {
      // Create instructor
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const result = await getInstructorCourses(instructorId);
      expect(result).toHaveLength(0);
    });
  });

  describe('updateCourse', () => {
    it('should update course for valid instructor', async () => {
      // Create instructor and course
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          title: 'Original Title',
          description: 'Original description',
          thumbnail_url: null,
          price: '49.99',
          instructor_id: instructorId,
          is_published: false,
          duration_hours: '5.0'
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      const updates = {
        title: 'Updated Title',
        price: 79.99,
        duration_hours: 8.0
      };

      const result = await updateCourse(courseId, updates, instructorId);

      expect(result.title).toEqual('Updated Title');
      expect(result.price).toEqual(79.99);
      expect(typeof result.price).toEqual('number');
      expect(result.duration_hours).toEqual(8.0);
      expect(result.description).toEqual('Original description'); // Unchanged
    });

    it('should throw error for non-existent course', async () => {
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      await expect(updateCourse(999, { title: 'New Title' }, instructorId))
        .rejects.toThrow(/course not found/i);
    });

    it('should throw error for non-owner instructor', async () => {
      // Create two instructors
      const instructor1Result = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructor1Id = instructor1Result[0].id;

      const instructor2Result = await db.insert(usersTable)
        .values({
          ...testInstructor,
          email: 'instructor2@test.com'
        })
        .returning()
        .execute();
      const instructor2Id = instructor2Result[0].id;

      // Create course with instructor1
      const courseResult = await db.insert(coursesTable)
        .values({
          title: 'Test Course',
          description: 'Test description',
          thumbnail_url: null,
          price: '49.99',
          instructor_id: instructor1Id,
          is_published: false,
          duration_hours: '5.0'
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      // Try to update with instructor2
      await expect(updateCourse(courseId, { title: 'Hacked Title' }, instructor2Id))
        .rejects.toThrow(/do not have permission/i);
    });
  });

  describe('publishCourse', () => {
    it('should publish course with lessons', async () => {
      // Create instructor and course
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          title: 'Test Course',
          description: 'Test description',
          thumbnail_url: null,
          price: '49.99',
          instructor_id: instructorId,
          is_published: false,
          duration_hours: '5.0'
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      // Add a lesson
      await db.insert(lessonsTable)
        .values({
          course_id: courseId,
          title: 'Test Lesson',
          description: null,
          video_url: null,
          content: 'Test content',
          order_index: 1,
          duration_minutes: 60,
          is_published: true
        })
        .execute();

      const result = await publishCourse(courseId, instructorId);

      expect(result.is_published).toEqual(true);
      expect(result.id).toEqual(courseId);
      expect(typeof result.price).toEqual('number');
    });

    it('should throw error for course without lessons', async () => {
      // Create instructor and course
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          title: 'Empty Course',
          description: 'No lessons',
          thumbnail_url: null,
          price: '49.99',
          instructor_id: instructorId,
          is_published: false,
          duration_hours: '5.0'
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      await expect(publishCourse(courseId, instructorId))
        .rejects.toThrow(/must have at least one lesson/i);
    });

    it('should throw error for non-existent course', async () => {
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      await expect(publishCourse(999, instructorId))
        .rejects.toThrow(/course not found/i);
    });

    it('should throw error for non-owner instructor', async () => {
      // Create two instructors
      const instructor1Result = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructor1Id = instructor1Result[0].id;

      const instructor2Result = await db.insert(usersTable)
        .values({
          ...testInstructor,
          email: 'instructor2@test.com'
        })
        .returning()
        .execute();
      const instructor2Id = instructor2Result[0].id;

      // Create course with instructor1
      const courseResult = await db.insert(coursesTable)
        .values({
          title: 'Test Course',
          description: 'Test description',
          thumbnail_url: null,
          price: '49.99',
          instructor_id: instructor1Id,
          is_published: false,
          duration_hours: '5.0'
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      // Try to publish with instructor2
      await expect(publishCourse(courseId, instructor2Id))
        .rejects.toThrow(/do not have permission/i);
    });
  });

  describe('deleteCourse', () => {
    it('should delete course for valid instructor', async () => {
      // Create instructor and course
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      const courseResult = await db.insert(coursesTable)
        .values({
          title: 'Course to Delete',
          description: 'Will be deleted',
          thumbnail_url: null,
          price: '49.99',
          instructor_id: instructorId,
          is_published: false,
          duration_hours: '5.0'
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      const result = await deleteCourse(courseId, instructorId);

      expect(result.success).toEqual(true);

      // Verify course is deleted
      const courses = await db.select()
        .from(coursesTable)
        .where(eq(coursesTable.id, courseId))
        .execute();
      
      expect(courses).toHaveLength(0);
    });

    it('should throw error for non-existent course', async () => {
      const instructorResult = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructorId = instructorResult[0].id;

      await expect(deleteCourse(999, instructorId))
        .rejects.toThrow(/course not found/i);
    });

    it('should throw error for non-owner instructor', async () => {
      // Create two instructors
      const instructor1Result = await db.insert(usersTable)
        .values(testInstructor)
        .returning()
        .execute();
      const instructor1Id = instructor1Result[0].id;

      const instructor2Result = await db.insert(usersTable)
        .values({
          ...testInstructor,
          email: 'instructor2@test.com'
        })
        .returning()
        .execute();
      const instructor2Id = instructor2Result[0].id;

      // Create course with instructor1
      const courseResult = await db.insert(coursesTable)
        .values({
          title: 'Protected Course',
          description: 'Cannot be deleted by others',
          thumbnail_url: null,
          price: '49.99',
          instructor_id: instructor1Id,
          is_published: false,
          duration_hours: '5.0'
        })
        .returning()
        .execute();
      const courseId = courseResult[0].id;

      // Try to delete with instructor2
      await expect(deleteCourse(courseId, instructor2Id))
        .rejects.toThrow(/do not have permission/i);
    });
  });
});