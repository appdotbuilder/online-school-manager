import { db } from '../db';
import { 
  quizzesTable, 
  quizQuestionsTable, 
  quizAttemptsTable, 
  lessonsTable,
  coursesTable,
  usersTable
} from '../db/schema';
import { 
  type CreateQuizInput, 
  type Quiz, 
  type CreateQuizQuestionInput, 
  type QuizQuestion, 
  type SubmitQuizInput, 
  type QuizAttempt 
} from '../schema';
import { eq, and, asc } from 'drizzle-orm';

export async function createQuiz(input: CreateQuizInput): Promise<Quiz> {
  try {
    // Verify lesson exists
    const lesson = await db.select()
      .from(lessonsTable)
      .where(eq(lessonsTable.id, input.lesson_id))
      .execute();

    if (lesson.length === 0) {
      throw new Error('Lesson not found');
    }

    const result = await db.insert(quizzesTable)
      .values({
        lesson_id: input.lesson_id,
        title: input.title,
        description: input.description,
        passing_score: input.passing_score,
        time_limit_minutes: input.time_limit_minutes,
        max_attempts: input.max_attempts,
        is_active: true
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Quiz creation failed:', error);
    throw error;
  }
}

export async function createQuizQuestion(input: CreateQuizQuestionInput): Promise<QuizQuestion> {
  try {
    // Verify quiz exists
    const quiz = await db.select()
      .from(quizzesTable)
      .where(eq(quizzesTable.id, input.quiz_id))
      .execute();

    if (quiz.length === 0) {
      throw new Error('Quiz not found');
    }

    const result = await db.insert(quizQuestionsTable)
      .values({
        quiz_id: input.quiz_id,
        question_text: input.question_text,
        question_type: input.question_type,
        options: input.options,
        correct_answer: input.correct_answer,
        points: input.points,
        order_index: input.order_index
      })
      .returning()
      .execute();

    // Convert points from string to number and cast options type
    const question = result[0];
    return {
      ...question,
      points: typeof question.points === 'string' ? parseInt(question.points) : question.points,
      options: question.options as string[] | null
    };
  } catch (error) {
    console.error('Quiz question creation failed:', error);
    throw error;
  }
}

export async function getQuizById(quizId: number): Promise<Quiz | null> {
  try {
    const result = await db.select()
      .from(quizzesTable)
      .where(eq(quizzesTable.id, quizId))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Get quiz failed:', error);
    throw error;
  }
}

export async function getQuizQuestions(quizId: number, includeAnswers: boolean = false): Promise<QuizQuestion[]> {
  try {
    const results = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_id, quizId))
      .orderBy(asc(quizQuestionsTable.order_index))
      .execute();

    return results.map(question => {
      const formattedQuestion = {
        ...question,
        points: typeof question.points === 'string' ? parseInt(question.points) : question.points,
        options: question.options as string[] | null
      };

      // Hide correct answers from students
      if (!includeAnswers) {
        return {
          ...formattedQuestion,
          correct_answer: ''
        };
      }

      return formattedQuestion;
    });
  } catch (error) {
    console.error('Get quiz questions failed:', error);
    throw error;
  }
}

export async function submitQuiz(input: SubmitQuizInput, studentId: number): Promise<QuizAttempt> {
  try {
    // Verify quiz exists
    const quiz = await db.select()
      .from(quizzesTable)
      .where(eq(quizzesTable.id, input.quiz_id))
      .execute();

    if (quiz.length === 0) {
      throw new Error('Quiz not found');
    }

    const currentQuiz = quiz[0];

    // Check if student has exceeded max attempts
    if (currentQuiz.max_attempts) {
      const previousAttempts = await db.select()
        .from(quizAttemptsTable)
        .where(and(
          eq(quizAttemptsTable.quiz_id, input.quiz_id),
          eq(quizAttemptsTable.student_id, studentId)
        ))
        .execute();

      if (previousAttempts.length >= currentQuiz.max_attempts) {
        throw new Error('Maximum attempts exceeded');
      }
    }

    // Get quiz questions with correct answers
    const questions = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_id, input.quiz_id))
      .execute();

    // Calculate score
    let score = 0;
    let totalPoints = 0;

    questions.forEach(question => {
      const questionPoints = typeof question.points === 'string' ? parseInt(question.points) : question.points;
      totalPoints += questionPoints;
      
      const studentAnswer = input.answers[question.id.toString()];
      if (studentAnswer && studentAnswer.toLowerCase().trim() === question.correct_answer.toLowerCase().trim()) {
        score += questionPoints;
      }
    });

    // Calculate percentage and determine if passed
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const isPassed = percentage >= currentQuiz.passing_score;

    // Create quiz attempt
    const result = await db.insert(quizAttemptsTable)
      .values({
        quiz_id: input.quiz_id,
        student_id: studentId,
        score,
        total_points: totalPoints,
        answers: input.answers,
        started_at: new Date(),
        completed_at: new Date(),
        is_passed: isPassed
      })
      .returning()
      .execute();

    // Cast answers type for return
    const attempt = result[0];
    return {
      ...attempt,
      answers: attempt.answers as Record<string, string>
    };
  } catch (error) {
    console.error('Quiz submission failed:', error);
    throw error;
  }
}

export async function getQuizAttempts(quizId: number, studentId: number): Promise<QuizAttempt[]> {
  try {
    const results = await db.select()
      .from(quizAttemptsTable)
      .where(and(
        eq(quizAttemptsTable.quiz_id, quizId),
        eq(quizAttemptsTable.student_id, studentId)
      ))
      .orderBy(asc(quizAttemptsTable.started_at))
      .execute();

    // Cast answers type for all results
    return results.map(attempt => ({
      ...attempt,
      answers: attempt.answers as Record<string, string>
    }));
  } catch (error) {
    console.error('Get quiz attempts failed:', error);
    throw error;
  }
}

export async function getStudentQuizAttempt(attemptId: number, studentId: number): Promise<QuizAttempt | null> {
  try {
    const result = await db.select()
      .from(quizAttemptsTable)
      .where(and(
        eq(quizAttemptsTable.id, attemptId),
        eq(quizAttemptsTable.student_id, studentId)
      ))
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Cast answers type for return
    const attempt = result[0];
    return {
      ...attempt,
      answers: attempt.answers as Record<string, string>
    };
  } catch (error) {
    console.error('Get student quiz attempt failed:', error);
    throw error;
  }
}

export async function updateQuiz(quizId: number, updates: Partial<CreateQuizInput>): Promise<Quiz> {
  try {
    // Verify quiz exists
    const existingQuiz = await db.select()
      .from(quizzesTable)
      .where(eq(quizzesTable.id, quizId))
      .execute();

    if (existingQuiz.length === 0) {
      throw new Error('Quiz not found');
    }

    // If lesson_id is being updated, verify the new lesson exists
    if (updates.lesson_id) {
      const lesson = await db.select()
        .from(lessonsTable)
        .where(eq(lessonsTable.id, updates.lesson_id))
        .execute();

      if (lesson.length === 0) {
        throw new Error('Lesson not found');
      }
    }

    const result = await db.update(quizzesTable)
      .set({
        ...updates,
        updated_at: new Date()
      })
      .where(eq(quizzesTable.id, quizId))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Quiz update failed:', error);
    throw error;
  }
}

export async function deleteQuiz(quizId: number): Promise<{ success: boolean }> {
  try {
    // Verify quiz exists
    const existingQuiz = await db.select()
      .from(quizzesTable)
      .where(eq(quizzesTable.id, quizId))
      .execute();

    if (existingQuiz.length === 0) {
      throw new Error('Quiz not found');
    }

    // Delete quiz questions first (foreign key dependency)
    await db.delete(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_id, quizId))
      .execute();

    // Delete quiz attempts
    await db.delete(quizAttemptsTable)
      .where(eq(quizAttemptsTable.quiz_id, quizId))
      .execute();

    // Delete the quiz
    await db.delete(quizzesTable)
      .where(eq(quizzesTable.id, quizId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Quiz deletion failed:', error);
    throw error;
  }
}