import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, coursesTable, enrollmentsTable, certificatesTable } from '../db/schema';
import {
  generateCertificate,
  getStudentCertificates,
  getCertificateByCode,
  getCertificateById,
  regenerateCertificate,
  getCourseCompletionStats
} from '../handlers/certificates';
import { eq, and } from 'drizzle-orm';

// Test data
let testStudent: any;
let testInstructor: any;
let testCourse: any;
let testEnrollment: any;

describe('Certificate Handlers', () => {
  beforeEach(async () => {
    await createDB();

    // Create test student
    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        role: 'student'
      })
      .returning()
      .execute();
    testStudent = studentResult[0];

    // Create test instructor
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'instructor'
      })
      .returning()
      .execute();
    testInstructor = instructorResult[0];

    // Create test course
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'Test Course',
        description: 'A test course for certification',
        price: '99.99',
        instructor_id: testInstructor.id,
        duration_hours: '10.5',
        is_published: true
      })
      .returning()
      .execute();
    testCourse = courseResult[0];

    // Create completed enrollment
    const enrollmentResult = await db.insert(enrollmentsTable)
      .values({
        student_id: testStudent.id,
        course_id: testCourse.id,
        progress_percentage: 100,
        is_completed: true,
        completion_date: new Date()
      })
      .returning()
      .execute();
    testEnrollment = enrollmentResult[0];
  });

  afterEach(resetDB);

  describe('generateCertificate', () => {
    it('should generate certificate for completed course', async () => {
      const result = await generateCertificate(testStudent.id, testCourse.id);

      expect(result.student_id).toEqual(testStudent.id);
      expect(result.course_id).toEqual(testCourse.id);
      expect(result.certificate_code).toMatch(/^CERT-\d+-\d+-\d+$/);
      expect(result.certificate_url).toContain(result.certificate_code);
      expect(result.id).toBeDefined();
      expect(result.issued_at).toBeInstanceOf(Date);
    });

    it('should save certificate to database', async () => {
      const result = await generateCertificate(testStudent.id, testCourse.id);

      const certificates = await db.select()
        .from(certificatesTable)
        .where(eq(certificatesTable.id, result.id))
        .execute();

      expect(certificates).toHaveLength(1);
      expect(certificates[0].student_id).toEqual(testStudent.id);
      expect(certificates[0].course_id).toEqual(testCourse.id);
      expect(certificates[0].certificate_code).toEqual(result.certificate_code);
    });

    it('should throw error for non-existent student', async () => {
      expect(generateCertificate(99999, testCourse.id))
        .rejects.toThrow(/student not found/i);
    });

    it('should throw error for non-existent course', async () => {
      expect(generateCertificate(testStudent.id, 99999))
        .rejects.toThrow(/course not found/i);
    });

    it('should throw error for incomplete course', async () => {
      // Create incomplete enrollment
      await db.update(enrollmentsTable)
        .set({ is_completed: false })
        .where(eq(enrollmentsTable.id, testEnrollment.id))
        .execute();

      expect(generateCertificate(testStudent.id, testCourse.id))
        .rejects.toThrow(/student has not completed/i);
    });

    it('should throw error for duplicate certificate', async () => {
      // Generate first certificate
      await generateCertificate(testStudent.id, testCourse.id);

      // Try to generate second certificate
      expect(generateCertificate(testStudent.id, testCourse.id))
        .rejects.toThrow(/certificate already exists/i);
    });
  });

  describe('getStudentCertificates', () => {
    it('should return empty array for student with no certificates', async () => {
      const result = await getStudentCertificates(testStudent.id);

      expect(result).toEqual([]);
    });

    it('should return student certificates', async () => {
      // Generate certificate
      const certificate = await generateCertificate(testStudent.id, testCourse.id);

      const result = await getStudentCertificates(testStudent.id);

      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(certificate.id);
      expect(result[0].student_id).toEqual(testStudent.id);
      expect(result[0].course_id).toEqual(testCourse.id);
    });

    it('should return multiple certificates for student', async () => {
      // Create another course and enrollment
      const secondCourseResult = await db.insert(coursesTable)
        .values({
          title: 'Second Test Course',
          description: 'Another test course',
          price: '49.99',
          instructor_id: testInstructor.id,
          duration_hours: '5.0',
          is_published: true
        })
        .returning()
        .execute();

      await db.insert(enrollmentsTable)
        .values({
          student_id: testStudent.id,
          course_id: secondCourseResult[0].id,
          progress_percentage: 100,
          is_completed: true,
          completion_date: new Date()
        })
        .execute();

      // Generate certificates for both courses
      await generateCertificate(testStudent.id, testCourse.id);
      await generateCertificate(testStudent.id, secondCourseResult[0].id);

      const result = await getStudentCertificates(testStudent.id);

      expect(result).toHaveLength(2);
      expect(result.every(cert => cert.student_id === testStudent.id)).toBe(true);
    });

    it('should throw error for non-existent student', async () => {
      expect(getStudentCertificates(99999))
        .rejects.toThrow(/student not found/i);
    });
  });

  describe('getCertificateByCode', () => {
    it('should return certificate by code', async () => {
      const certificate = await generateCertificate(testStudent.id, testCourse.id);

      const result = await getCertificateByCode(certificate.certificate_code);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(certificate.id);
      expect(result!.certificate_code).toEqual(certificate.certificate_code);
      expect(result!.student_id).toEqual(testStudent.id);
    });

    it('should return null for non-existent certificate code', async () => {
      const result = await getCertificateByCode('INVALID-CODE');

      expect(result).toBeNull();
    });
  });

  describe('getCertificateById', () => {
    it('should return certificate by ID', async () => {
      const certificate = await generateCertificate(testStudent.id, testCourse.id);

      const result = await getCertificateById(certificate.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(certificate.id);
      expect(result!.student_id).toEqual(testStudent.id);
      expect(result!.course_id).toEqual(testCourse.id);
    });

    it('should return null for non-existent certificate ID', async () => {
      const result = await getCertificateById(99999);

      expect(result).toBeNull();
    });
  });

  describe('regenerateCertificate', () => {
    it('should regenerate certificate with new code and URL', async () => {
      const originalCertificate = await generateCertificate(testStudent.id, testCourse.id);
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await regenerateCertificate(originalCertificate.id);

      expect(result.id).toEqual(originalCertificate.id);
      expect(result.student_id).toEqual(originalCertificate.student_id);
      expect(result.course_id).toEqual(originalCertificate.course_id);
      expect(result.certificate_code).not.toEqual(originalCertificate.certificate_code);
      expect(result.certificate_code).toMatch(/^CERT-REGEN-\d+-\d+-\d+$/);
      expect(result.certificate_url).toContain(result.certificate_code);
      expect(result.issued_at.getTime()).toBeGreaterThan(originalCertificate.issued_at.getTime());
    });

    it('should update certificate in database', async () => {
      const originalCertificate = await generateCertificate(testStudent.id, testCourse.id);
      const regenerated = await regenerateCertificate(originalCertificate.id);

      const certificates = await db.select()
        .from(certificatesTable)
        .where(eq(certificatesTable.id, originalCertificate.id))
        .execute();

      expect(certificates).toHaveLength(1);
      expect(certificates[0].certificate_code).toEqual(regenerated.certificate_code);
      expect(certificates[0].certificate_url).toEqual(regenerated.certificate_url);
    });

    it('should throw error for non-existent certificate', async () => {
      expect(regenerateCertificate(99999))
        .rejects.toThrow(/certificate not found/i);
    });
  });

  describe('getCourseCompletionStats', () => {
    it('should return stats for course with enrollments', async () => {
      // Create additional students and enrollments
      const student2Result = await db.insert(usersTable)
        .values({
          email: 'student2@example.com',
          password_hash: 'hashedpassword',
          first_name: 'Alice',
          last_name: 'Johnson',
          role: 'student'
        })
        .returning()
        .execute();

      const student3Result = await db.insert(usersTable)
        .values({
          email: 'student3@example.com',
          password_hash: 'hashedpassword',
          first_name: 'Bob',
          last_name: 'Wilson',
          role: 'student'
        })
        .returning()
        .execute();

      // Create enrollments: one completed, one incomplete
      await db.insert(enrollmentsTable)
        .values({
          student_id: student2Result[0].id,
          course_id: testCourse.id,
          progress_percentage: 100,
          is_completed: true,
          completion_date: new Date()
        })
        .execute();

      await db.insert(enrollmentsTable)
        .values({
          student_id: student3Result[0].id,
          course_id: testCourse.id,
          progress_percentage: 50,
          is_completed: false
        })
        .execute();

      // Generate certificates for completed students
      await generateCertificate(testStudent.id, testCourse.id);
      await generateCertificate(student2Result[0].id, testCourse.id);

      const result = await getCourseCompletionStats(testCourse.id);

      expect(result.totalEnrollments).toEqual(3); // testStudent + student2 + student3
      expect(result.totalCompletions).toEqual(2); // testStudent + student2
      expect(result.completionRate).toEqual(66.67); // 2/3 * 100, rounded
      expect(result.certificatesIssued).toEqual(2);
    });

    it('should return zero stats for course with no enrollments', async () => {
      // Create course with no enrollments
      const emptyCourseResult = await db.insert(coursesTable)
        .values({
          title: 'Empty Course',
          description: 'Course with no enrollments',
          price: '29.99',
          instructor_id: testInstructor.id,
          duration_hours: '3.0',
          is_published: true
        })
        .returning()
        .execute();

      const result = await getCourseCompletionStats(emptyCourseResult[0].id);

      expect(result.totalEnrollments).toEqual(0);
      expect(result.totalCompletions).toEqual(0);
      expect(result.completionRate).toEqual(0);
      expect(result.certificatesIssued).toEqual(0);
    });

    it('should handle course with enrollments but no completions', async () => {
      // Update existing enrollment to be incomplete
      await db.update(enrollmentsTable)
        .set({ is_completed: false, progress_percentage: 25 })
        .where(eq(enrollmentsTable.id, testEnrollment.id))
        .execute();

      const result = await getCourseCompletionStats(testCourse.id);

      expect(result.totalEnrollments).toEqual(1);
      expect(result.totalCompletions).toEqual(0);
      expect(result.completionRate).toEqual(0);
      expect(result.certificatesIssued).toEqual(0);
    });

    it('should throw error for non-existent course', async () => {
      expect(getCourseCompletionStats(99999))
        .rejects.toThrow(/course not found/i);
    });
  });
});