import { db } from '../db';
import { certificatesTable, usersTable, coursesTable, enrollmentsTable } from '../db/schema';
import { type Certificate } from '../schema';
import { eq, and, count } from 'drizzle-orm';

export async function generateCertificate(studentId: number, courseId: number): Promise<Certificate> {
  try {
    // Verify student exists
    const student = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, studentId))
      .execute();

    if (student.length === 0) {
      throw new Error('Student not found');
    }

    // Verify course exists
    const course = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .execute();

    if (course.length === 0) {
      throw new Error('Course not found');
    }

    // Check if enrollment exists and is completed
    const enrollment = await db.select()
      .from(enrollmentsTable)
      .where(
        and(
          eq(enrollmentsTable.student_id, studentId),
          eq(enrollmentsTable.course_id, courseId),
          eq(enrollmentsTable.is_completed, true)
        )
      )
      .execute();

    if (enrollment.length === 0) {
      throw new Error('Student has not completed this course');
    }

    // Check if certificate already exists
    const existingCertificate = await db.select()
      .from(certificatesTable)
      .where(
        and(
          eq(certificatesTable.student_id, studentId),
          eq(certificatesTable.course_id, courseId)
        )
      )
      .execute();

    if (existingCertificate.length > 0) {
      throw new Error('Certificate already exists for this student and course');
    }

    // Generate unique certificate code
    const certificateCode = `CERT-${Date.now()}-${studentId}-${courseId}`;

    // Insert certificate record
    const result = await db.insert(certificatesTable)
      .values({
        student_id: studentId,
        course_id: courseId,
        certificate_url: `https://certificates.example.com/${certificateCode}.pdf`,
        certificate_code: certificateCode
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Certificate generation failed:', error);
    throw error;
  }
}

export async function getStudentCertificates(studentId: number): Promise<Certificate[]> {
  try {
    // Verify student exists
    const student = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, studentId))
      .execute();

    if (student.length === 0) {
      throw new Error('Student not found');
    }

    // Fetch all certificates for the student
    const certificates = await db.select()
      .from(certificatesTable)
      .where(eq(certificatesTable.student_id, studentId))
      .execute();

    return certificates;
  } catch (error) {
    console.error('Failed to fetch student certificates:', error);
    throw error;
  }
}

export async function getCertificateByCode(certificateCode: string): Promise<Certificate | null> {
  try {
    const certificates = await db.select()
      .from(certificatesTable)
      .where(eq(certificatesTable.certificate_code, certificateCode))
      .execute();

    return certificates.length > 0 ? certificates[0] : null;
  } catch (error) {
    console.error('Failed to fetch certificate by code:', error);
    throw error;
  }
}

export async function getCertificateById(certificateId: number): Promise<Certificate | null> {
  try {
    const certificates = await db.select()
      .from(certificatesTable)
      .where(eq(certificatesTable.id, certificateId))
      .execute();

    return certificates.length > 0 ? certificates[0] : null;
  } catch (error) {
    console.error('Failed to fetch certificate by ID:', error);
    throw error;
  }
}

export async function regenerateCertificate(certificateId: number): Promise<Certificate> {
  try {
    // Verify certificate exists
    const existingCertificate = await getCertificateById(certificateId);
    if (!existingCertificate) {
      throw new Error('Certificate not found');
    }

    // Generate new certificate code and URL
    const newCertificateCode = `CERT-REGEN-${Date.now()}-${existingCertificate.student_id}-${existingCertificate.course_id}`;
    const newCertificateUrl = `https://certificates.example.com/${newCertificateCode}.pdf`;

    // Update certificate with new URL and code
    const result = await db.update(certificatesTable)
      .set({
        certificate_code: newCertificateCode,
        certificate_url: newCertificateUrl,
        issued_at: new Date()
      })
      .where(eq(certificatesTable.id, certificateId))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Certificate regeneration failed:', error);
    throw error;
  }
}

export async function getCourseCompletionStats(courseId: number): Promise<{
  totalEnrollments: number;
  totalCompletions: number;
  completionRate: number;
  certificatesIssued: number;
}> {
  try {
    // Verify course exists
    const course = await db.select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .execute();

    if (course.length === 0) {
      throw new Error('Course not found');
    }

    // Get total enrollments
    const totalEnrollmentsResult = await db.select({ count: count() })
      .from(enrollmentsTable)
      .where(eq(enrollmentsTable.course_id, courseId))
      .execute();

    const totalEnrollments = totalEnrollmentsResult[0].count;

    // Get total completions
    const totalCompletionsResult = await db.select({ count: count() })
      .from(enrollmentsTable)
      .where(
        and(
          eq(enrollmentsTable.course_id, courseId),
          eq(enrollmentsTable.is_completed, true)
        )
      )
      .execute();

    const totalCompletions = totalCompletionsResult[0].count;

    // Get certificates issued
    const certificatesIssuedResult = await db.select({ count: count() })
      .from(certificatesTable)
      .where(eq(certificatesTable.course_id, courseId))
      .execute();

    const certificatesIssued = certificatesIssuedResult[0].count;

    // Calculate completion rate
    const completionRate = totalEnrollments > 0 ? (totalCompletions / totalEnrollments) * 100 : 0;

    return {
      totalEnrollments,
      totalCompletions,
      completionRate: Math.round(completionRate * 100) / 100, // Round to 2 decimal places
      certificatesIssued
    };
  } catch (error) {
    console.error('Failed to fetch course completion stats:', error);
    throw error;
  }
}