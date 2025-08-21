import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  coursesTable, 
  lessonsTable, 
  quizzesTable, 
  quizQuestionsTable,
  quizAttemptsTable
} from '../db/schema';
import { 
  type CreateQuizInput, 
  type CreateQuizQuestionInput, 
  type SubmitQuizInput 
} from '../schema';
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
} from '../handlers/quizzes';
import { eq, and } from 'drizzle-orm';

// Test data
let testUserId: number;
let testCourseId: number;
let testLessonId: number;
let testQuizId: number;
let testStudentId: number;

const testQuizInput: CreateQuizInput = {
  lesson_id: 0, // Will be set in beforeEach
  title: 'JavaScript Fundamentals Quiz',
  description: 'Test your knowledge of JavaScript basics',
  passing_score: 70,
  time_limit_minutes: 30,
  max_attempts: 3
};

const testQuestionInputs: CreateQuizQuestionInput[] = [
  {
    quiz_id: 0, // Will be set after quiz creation
    question_text: 'What is the output of typeof null?',
    question_type: 'multiple_choice',
    options: ['null', 'object', 'undefined', 'string'],
    correct_answer: 'object',
    points: 10,
    order_index: 1
  },
  {
    quiz_id: 0,
    question_text: 'JavaScript is a compiled language.',
    question_type: 'true_false',
    options: ['true', 'false'],
    correct_answer: 'false',
    points: 5,
    order_index: 2
  },
  {
    quiz_id: 0,
    question_text: 'What method is used to add an element to the end of an array?',
    question_type: 'short_answer',
    options: null,
    correct_answer: 'push',
    points: 15,
    order_index: 3
  }
];

describe('Quiz Handlers', () => {
  beforeEach(async () => {
    await createDB();

    // Create test instructor
    const instructorResult = await db.insert(usersTable)
      .values({
        email: 'instructor@test.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Instructor',
        role: 'instructor',
        is_active: true,
        email_verified: true
      })
      .returning()
      .execute();
    testUserId = instructorResult[0].id;

    // Create test student
    const studentResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password_hash: 'hashedpassword',
        first_name: 'Jane',
        last_name: 'Student',
        role: 'student',
        is_active: true,
        email_verified: true
      })
      .returning()
      .execute();
    testStudentId = studentResult[0].id;

    // Create test course
    const courseResult = await db.insert(coursesTable)
      .values({
        title: 'JavaScript Basics',
        description: 'Learn JavaScript fundamentals',
        price: '49.99',
        instructor_id: testUserId,
        duration_hours: '10.5',
        is_published: true
      })
      .returning()
      .execute();
    testCourseId = courseResult[0].id;

    // Create test lesson
    const lessonResult = await db.insert(lessonsTable)
      .values({
        course_id: testCourseId,
        title: 'Variables and Data Types',
        description: 'Understanding JavaScript variables',
        order_index: 1,
        duration_minutes: 45,
        is_published: true
      })
      .returning()
      .execute();
    testLessonId = lessonResult[0].id;

    // Update test input with actual lesson ID
    testQuizInput.lesson_id = testLessonId;
    testQuestionInputs.forEach(q => q.quiz_id = 0); // Will be set after quiz creation
  });

  afterEach(resetDB);

  describe('createQuiz', () => {
    it('should create a quiz successfully', async () => {
      const result = await createQuiz(testQuizInput);

      expect(result.id).toBeDefined();
      expect(result.lesson_id).toEqual(testLessonId);
      expect(result.title).toEqual('JavaScript Fundamentals Quiz');
      expect(result.description).toEqual('Test your knowledge of JavaScript basics');
      expect(result.passing_score).toEqual(70);
      expect(result.time_limit_minutes).toEqual(30);
      expect(result.max_attempts).toEqual(3);
      expect(result.is_active).toBe(true);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save quiz to database', async () => {
      const result = await createQuiz(testQuizInput);

      const quizzes = await db.select()
        .from(quizzesTable)
        .where(eq(quizzesTable.id, result.id))
        .execute();

      expect(quizzes).toHaveLength(1);
      expect(quizzes[0].title).toEqual('JavaScript Fundamentals Quiz');
      expect(quizzes[0].lesson_id).toEqual(testLessonId);
    });

    it('should throw error for non-existent lesson', async () => {
      const invalidInput = { ...testQuizInput, lesson_id: 9999 };

      await expect(createQuiz(invalidInput)).rejects.toThrow(/lesson not found/i);
    });

    it('should create quiz with minimal data', async () => {
      const minimalInput: CreateQuizInput = {
        lesson_id: testLessonId,
        title: 'Simple Quiz',
        description: null,
        passing_score: 50,
        time_limit_minutes: null,
        max_attempts: null
      };

      const result = await createQuiz(minimalInput);

      expect(result.title).toEqual('Simple Quiz');
      expect(result.description).toBeNull();
      expect(result.time_limit_minutes).toBeNull();
      expect(result.max_attempts).toBeNull();
    });
  });

  describe('createQuizQuestion', () => {
    beforeEach(async () => {
      const quiz = await createQuiz(testQuizInput);
      testQuizId = quiz.id;
      testQuestionInputs.forEach(q => q.quiz_id = testQuizId);
    });

    it('should create a multiple choice question', async () => {
      const questionInput = testQuestionInputs[0];
      const result = await createQuizQuestion(questionInput);

      expect(result.id).toBeDefined();
      expect(result.quiz_id).toEqual(testQuizId);
      expect(result.question_text).toEqual('What is the output of typeof null?');
      expect(result.question_type).toEqual('multiple_choice');
      expect(result.options).toEqual(['null', 'object', 'undefined', 'string']);
      expect(result.correct_answer).toEqual('object');
      expect(result.points).toEqual(10);
      expect(typeof result.points).toBe('number');
      expect(result.order_index).toEqual(1);
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create a true/false question', async () => {
      const questionInput = testQuestionInputs[1];
      const result = await createQuizQuestion(questionInput);

      expect(result.question_type).toEqual('true_false');
      expect(result.options).toEqual(['true', 'false']);
      expect(result.correct_answer).toEqual('false');
      expect(result.points).toEqual(5);
    });

    it('should create a short answer question', async () => {
      const questionInput = testQuestionInputs[2];
      const result = await createQuizQuestion(questionInput);

      expect(result.question_type).toEqual('short_answer');
      expect(result.options).toBeNull();
      expect(result.correct_answer).toEqual('push');
      expect(result.points).toEqual(15);
    });

    it('should save question to database', async () => {
      const questionInput = testQuestionInputs[0];
      const result = await createQuizQuestion(questionInput);

      const questions = await db.select()
        .from(quizQuestionsTable)
        .where(eq(quizQuestionsTable.id, result.id))
        .execute();

      expect(questions).toHaveLength(1);
      expect(questions[0].question_text).toEqual('What is the output of typeof null?');
    });

    it('should throw error for non-existent quiz', async () => {
      const invalidInput = { ...testQuestionInputs[0], quiz_id: 9999 };

      await expect(createQuizQuestion(invalidInput)).rejects.toThrow(/quiz not found/i);
    });
  });

  describe('getQuizById', () => {
    beforeEach(async () => {
      const quiz = await createQuiz(testQuizInput);
      testQuizId = quiz.id;
    });

    it('should return quiz by id', async () => {
      const result = await getQuizById(testQuizId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(testQuizId);
      expect(result!.title).toEqual('JavaScript Fundamentals Quiz');
    });

    it('should return null for non-existent quiz', async () => {
      const result = await getQuizById(9999);

      expect(result).toBeNull();
    });
  });

  describe('getQuizQuestions', () => {
    beforeEach(async () => {
      const quiz = await createQuiz(testQuizInput);
      testQuizId = quiz.id;
      testQuestionInputs.forEach(q => q.quiz_id = testQuizId);

      // Create all test questions
      for (const questionInput of testQuestionInputs) {
        await createQuizQuestion(questionInput);
      }
    });

    it('should return questions without answers for students', async () => {
      const result = await getQuizQuestions(testQuizId, false);

      expect(result).toHaveLength(3);
      expect(result[0].correct_answer).toEqual(''); // Hidden for students
      expect(result[0].question_text).toEqual('What is the output of typeof null?');
      expect(result[0].points).toEqual(10);
      expect(typeof result[0].points).toBe('number');
    });

    it('should return questions with answers for instructors', async () => {
      const result = await getQuizQuestions(testQuizId, true);

      expect(result).toHaveLength(3);
      expect(result[0].correct_answer).toEqual('object'); // Shown for instructors
      expect(result[1].correct_answer).toEqual('false');
      expect(result[2].correct_answer).toEqual('push');
    });

    it('should return questions in correct order', async () => {
      const result = await getQuizQuestions(testQuizId, true);

      expect(result[0].order_index).toEqual(1);
      expect(result[1].order_index).toEqual(2);
      expect(result[2].order_index).toEqual(3);
    });

    it('should return empty array for non-existent quiz', async () => {
      const result = await getQuizQuestions(9999, false);

      expect(result).toHaveLength(0);
    });
  });

  describe('submitQuiz', () => {
    let questionIds: number[] = [];

    beforeEach(async () => {
      const quiz = await createQuiz(testQuizInput);
      testQuizId = quiz.id;
      testQuestionInputs.forEach(q => q.quiz_id = testQuizId);

      // Create questions and store their IDs
      questionIds = [];
      for (const questionInput of testQuestionInputs) {
        const question = await createQuizQuestion(questionInput);
        questionIds.push(question.id);
      }
    });

    it('should submit quiz and calculate score correctly', async () => {
      const submitInput: SubmitQuizInput = {
        quiz_id: testQuizId,
        answers: {
          [questionIds[0]]: 'object',  // Correct (10 points)
          [questionIds[1]]: 'false',   // Correct (5 points)
          [questionIds[2]]: 'push'     // Correct (15 points)
        }
      };

      const result = await submitQuiz(submitInput, testStudentId);

      expect(result.id).toBeDefined();
      expect(result.quiz_id).toEqual(testQuizId);
      expect(result.student_id).toEqual(testStudentId);
      expect(result.score).toEqual(30); // All correct
      expect(result.total_points).toEqual(30);
      expect(result.is_passed).toBe(true); // 100% > 70%
      expect(result.started_at).toBeInstanceOf(Date);
      expect(result.completed_at).toBeInstanceOf(Date);
      expect(result.answers).toEqual(submitInput.answers);
    });

    it('should handle partial correct answers', async () => {
      const submitInput: SubmitQuizInput = {
        quiz_id: testQuizId,
        answers: {
          [questionIds[0]]: 'object',  // Correct (10 points)
          [questionIds[1]]: 'true',    // Wrong (0 points)
          [questionIds[2]]: 'pop'      // Wrong (0 points)
        }
      };

      const result = await submitQuiz(submitInput, testStudentId);

      expect(result.score).toEqual(10); // Only first question correct
      expect(result.total_points).toEqual(30);
      expect(result.is_passed).toBe(false); // 33% < 70%
    });

    it('should handle case-insensitive answers', async () => {
      const submitInput: SubmitQuizInput = {
        quiz_id: testQuizId,
        answers: {
          [questionIds[0]]: 'OBJECT',  // Correct (case insensitive)
          [questionIds[1]]: 'FALSE',   // Correct (case insensitive)
          [questionIds[2]]: 'Push'     // Correct (case insensitive)
        }
      };

      const result = await submitQuiz(submitInput, testStudentId);

      expect(result.score).toEqual(30);
      expect(result.is_passed).toBe(true);
    });

    it('should enforce max attempts limit', async () => {
      const submitInput: SubmitQuizInput = {
        quiz_id: testQuizId,
        answers: { [questionIds[0]]: 'wrong' }
      };

      // Make 3 attempts (max allowed)
      await submitQuiz(submitInput, testStudentId);
      await submitQuiz(submitInput, testStudentId);
      await submitQuiz(submitInput, testStudentId);

      // 4th attempt should fail
      await expect(submitQuiz(submitInput, testStudentId))
        .rejects.toThrow(/maximum attempts exceeded/i);
    });

    it('should throw error for non-existent quiz', async () => {
      const submitInput: SubmitQuizInput = {
        quiz_id: 9999,
        answers: {}
      };

      await expect(submitQuiz(submitInput, testStudentId))
        .rejects.toThrow(/quiz not found/i);
    });
  });

  describe('getQuizAttempts', () => {
    let questionIds: number[] = [];

    beforeEach(async () => {
      const quiz = await createQuiz(testQuizInput);
      testQuizId = quiz.id;
      testQuestionInputs.forEach(q => q.quiz_id = testQuizId);

      questionIds = [];
      for (const questionInput of testQuestionInputs) {
        const question = await createQuizQuestion(questionInput);
        questionIds.push(question.id);
      }
    });

    it('should return student quiz attempts', async () => {
      const submitInput: SubmitQuizInput = {
        quiz_id: testQuizId,
        answers: { [questionIds[0]]: 'object' }
      };

      // Make two attempts
      await submitQuiz(submitInput, testStudentId);
      await submitQuiz(submitInput, testStudentId);

      const result = await getQuizAttempts(testQuizId, testStudentId);

      expect(result).toHaveLength(2);
      expect(result[0].student_id).toEqual(testStudentId);
      expect(result[1].student_id).toEqual(testStudentId);
    });

    it('should return empty array for no attempts', async () => {
      const result = await getQuizAttempts(testQuizId, testStudentId);

      expect(result).toHaveLength(0);
    });
  });

  describe('getStudentQuizAttempt', () => {
    let attemptId: number;
    let questionIds: number[] = [];

    beforeEach(async () => {
      const quiz = await createQuiz(testQuizInput);
      testQuizId = quiz.id;
      testQuestionInputs.forEach(q => q.quiz_id = testQuizId);

      questionIds = [];
      for (const questionInput of testQuestionInputs) {
        const question = await createQuizQuestion(questionInput);
        questionIds.push(question.id);
      }

      const submitInput: SubmitQuizInput = {
        quiz_id: testQuizId,
        answers: { [questionIds[0]]: 'object' }
      };

      const attempt = await submitQuiz(submitInput, testStudentId);
      attemptId = attempt.id;
    });

    it('should return specific quiz attempt', async () => {
      const result = await getStudentQuizAttempt(attemptId, testStudentId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(attemptId);
      expect(result!.student_id).toEqual(testStudentId);
    });

    it('should return null for non-existent attempt', async () => {
      const result = await getStudentQuizAttempt(9999, testStudentId);

      expect(result).toBeNull();
    });

    it('should return null for attempt belonging to different student', async () => {
      const result = await getStudentQuizAttempt(attemptId, 9999);

      expect(result).toBeNull();
    });
  });

  describe('updateQuiz', () => {
    beforeEach(async () => {
      const quiz = await createQuiz(testQuizInput);
      testQuizId = quiz.id;
    });

    it('should update quiz fields', async () => {
      const updates: Partial<CreateQuizInput> = {
        title: 'Updated Quiz Title',
        passing_score: 80,
        max_attempts: 5
      };

      const result = await updateQuiz(testQuizId, updates);

      expect(result.title).toEqual('Updated Quiz Title');
      expect(result.passing_score).toEqual(80);
      expect(result.max_attempts).toEqual(5);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save updates to database', async () => {
      const updates = { title: 'Database Updated Quiz' };

      await updateQuiz(testQuizId, updates);

      const quiz = await db.select()
        .from(quizzesTable)
        .where(eq(quizzesTable.id, testQuizId))
        .execute();

      expect(quiz[0].title).toEqual('Database Updated Quiz');
    });

    it('should throw error for non-existent quiz', async () => {
      const updates = { title: 'Updated Title' };

      await expect(updateQuiz(9999, updates))
        .rejects.toThrow(/quiz not found/i);
    });

    it('should validate lesson existence when updating lesson_id', async () => {
      const updates = { lesson_id: 9999 };

      await expect(updateQuiz(testQuizId, updates))
        .rejects.toThrow(/lesson not found/i);
    });
  });

  describe('deleteQuiz', () => {
    let questionIds: number[] = [];

    beforeEach(async () => {
      const quiz = await createQuiz(testQuizInput);
      testQuizId = quiz.id;
      testQuestionInputs.forEach(q => q.quiz_id = testQuizId);

      // Create questions and attempts
      questionIds = [];
      for (const questionInput of testQuestionInputs) {
        const question = await createQuizQuestion(questionInput);
        questionIds.push(question.id);
      }

      // Create an attempt
      const submitInput: SubmitQuizInput = {
        quiz_id: testQuizId,
        answers: { [questionIds[0]]: 'object' }
      };
      await submitQuiz(submitInput, testStudentId);
    });

    it('should delete quiz and related data', async () => {
      const result = await deleteQuiz(testQuizId);

      expect(result.success).toBe(true);

      // Verify quiz is deleted
      const quizzes = await db.select()
        .from(quizzesTable)
        .where(eq(quizzesTable.id, testQuizId))
        .execute();
      expect(quizzes).toHaveLength(0);

      // Verify questions are deleted
      const questions = await db.select()
        .from(quizQuestionsTable)
        .where(eq(quizQuestionsTable.quiz_id, testQuizId))
        .execute();
      expect(questions).toHaveLength(0);

      // Verify attempts are deleted
      const attempts = await db.select()
        .from(quizAttemptsTable)
        .where(eq(quizAttemptsTable.quiz_id, testQuizId))
        .execute();
      expect(attempts).toHaveLength(0);
    });

    it('should throw error for non-existent quiz', async () => {
      await expect(deleteQuiz(9999))
        .rejects.toThrow(/quiz not found/i);
    });
  });
});