import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Clock, CheckCircle, XCircle, Award } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { Quiz, QuizQuestion } from '../../../server/src/schema';

interface QuizSystemProps {
  quiz: Quiz;
  onComplete: () => void;
  onBack: () => void;
}

export function QuizSystem({ quiz, onComplete, onBack }: QuizSystemProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Load quiz questions
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const questionsData = await trpc.getQuizQuestions.query({ 
          quizId: quiz.id, 
          includeAnswers: false 
        });
        setQuestions(questionsData);
        
        // Set timer if quiz has time limit
        if (quiz.time_limit_minutes) {
          setTimeLeft(quiz.time_limit_minutes * 60); // Convert to seconds
        }
      } catch (error) {
        console.error('Failed to load quiz questions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestions();
  }, [quiz.id, quiz.time_limit_minutes]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isSubmitted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev && prev <= 1) {
          handleSubmit(); // Auto-submit when time runs out
          return 0;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId.toString()]: answer
    }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const submission = await trpc.submitQuiz.mutate({
        quiz_id: quiz.id,
        answers
      });
      setResult(submission);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (isSubmitted && result) {
    const isPassed = result.is_passed;
    const scorePercentage = Math.round((result.score / result.total_points) * 100);

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Course
              </Button>
              <div>
                <h1 className="text-lg font-semibold">{quiz.title}</h1>
                <p className="text-sm text-gray-600">Quiz Results</p>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                isPassed ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {isPassed ? (
                  <Award className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
              </div>
              <CardTitle className={`text-2xl ${isPassed ? 'text-green-800' : 'text-red-800'}`}>
                {isPassed ? 'Congratulations! 🎉' : 'Not Quite There 😔'}
              </CardTitle>
              <CardDescription className="text-lg">
                {isPassed 
                  ? 'You have successfully passed the quiz!' 
                  : 'You didn\'t meet the passing score this time.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold">{scorePercentage}%</div>
                  <div className="text-sm text-gray-600">Your Score</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold">{quiz.passing_score}%</div>
                  <div className="text-sm text-gray-600">Passing Score</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Score: {result.score} / {result.total_points} points</span>
                </div>
                <Progress value={scorePercentage} className="h-3" />
              </div>

              {quiz.max_attempts && (
                <div className="text-center text-sm text-gray-600">
                  {!isPassed && (
                    <p>You can retake this quiz. Attempts remaining: {quiz.max_attempts - 1}</p>
                  )}
                </div>
              )}

              <div className="flex space-x-4 pt-4">
                <Button onClick={onComplete} className="flex-1">
                  Continue Course
                </Button>
                {!isPassed && quiz.max_attempts && (
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Retake Quiz
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white p-4 shadow-sm">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Course
          </Button>
        </div>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500">No questions found for this quiz.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{quiz.title}</h1>
              <p className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {timeLeft !== null && (
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className={timeLeft < 300 ? 'text-red-600 font-semibold' : ''}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}
            <Badge variant="outline">
              Passing Score: {quiz.passing_score}%
            </Badge>
          </div>
        </div>
        
        <div className="mt-4">
          <Progress value={progress} />
        </div>
      </div>

      {/* Quiz Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Question {currentQuestionIndex + 1}</CardTitle>
              <CardDescription>
                {currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-lg font-medium">
                {currentQuestion.question_text}
              </div>

              {/* Multiple Choice */}
              {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options && (
                <RadioGroup
                  value={answers[currentQuestion.id.toString()] || ''}
                  onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                >
                  <div className="space-y-3">
                    {currentQuestion.options.map((option: string, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`option-${index}`} />
                        <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              )}

              {/* True/False */}
              {currentQuestion.question_type === 'true_false' && (
                <RadioGroup
                  value={answers[currentQuestion.id.toString()] || ''}
                  onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="true" />
                      <Label htmlFor="true" className="cursor-pointer">True</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="false" />
                      <Label htmlFor="false" className="cursor-pointer">False</Label>
                    </div>
                  </div>
                </RadioGroup>
              )}

              {/* Short Answer */}
              {currentQuestion.question_type === 'short_answer' && (
                <Input
                  placeholder="Enter your answer..."
                  value={answers[currentQuestion.id.toString()] || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleAnswerChange(currentQuestion.id, e.target.value)
                  }
                />
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                >
                  Previous
                </Button>

                {currentQuestionIndex === questions.length - 1 ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!answers[currentQuestion.id.toString()]}
                  >
                    Submit Quiz
                  </Button>
                ) : (
                  <Button
                    onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                    disabled={!answers[currentQuestion.id.toString()]}
                  >
                    Next
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}