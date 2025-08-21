import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import { ArrowLeft, Plus, FileText, Edit, Trash2, HelpCircle } from 'lucide-react';
import type { Course, Quiz, CreateQuizInput, CreateQuizQuestionInput, QuestionType } from '../../../server/src/schema';

interface QuizManagementProps {
  course: Course;
  onBack: () => void;
}

export function QuizManagement({ course, onBack }: QuizManagementProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  
  const [quizData, setQuizData] = useState<CreateQuizInput>({
    lesson_id: 1, // This would need to be selected from available lessons
    title: '',
    description: null,
    passing_score: 70,
    time_limit_minutes: null,
    max_attempts: null
  });

  const [questionData, setQuestionData] = useState<CreateQuizQuestionInput>({
    quiz_id: 0,
    question_text: '',
    question_type: 'multiple_choice',
    options: null,
    correct_answer: '',
    points: 1,
    order_index: 1
  });

  const loadQuizzes = useCallback(async () => {
    setIsLoading(true);
    try {
      // For demo purposes, we'll create mock quiz data since we need lessons first
      setQuizzes([
        {
          id: 1,
          lesson_id: 1,
          title: 'Course Assessment Quiz',
          description: 'Test your knowledge of the course material',
          passing_score: 70,
          time_limit_minutes: 30,
          max_attempts: 3,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
    } catch (error) {
      console.error('Failed to load quizzes:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.createQuiz.mutate(quizData);
      setShowCreateDialog(false);
      setQuizData({
        lesson_id: 1,
        title: '',
        description: null,
        passing_score: 70,
        time_limit_minutes: null,
        max_attempts: null
      });
      loadQuizzes();
    } catch (error) {
      console.error('Failed to create quiz:', error);
      alert('Failed to create quiz');
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.createQuizQuestion.mutate(questionData);
      setShowQuestionDialog(false);
      setQuestionData({
        quiz_id: 0,
        question_text: '',
        question_type: 'multiple_choice',
        options: null,
        correct_answer: '',
        points: 1,
        order_index: 1
      });
    } catch (error) {
      console.error('Failed to add question:', error);
      alert('Failed to add question');
    }
  };

  const handleDeleteQuiz = async (quizId: number) => {
    if (window.confirm('Are you sure you want to delete this quiz?')) {
      try {
        await trpc.deleteQuiz.mutate({ quizId });
        loadQuizzes();
      } catch (error) {
        console.error('Failed to delete quiz:', error);
      }
    }
  };

  const handleQuestionTypeChange = (type: QuestionType) => {
    setQuestionData((prev: CreateQuizQuestionInput) => ({
      ...prev,
      question_type: type,
      options: type === 'multiple_choice' ? ['Option 1', 'Option 2', 'Option 3', 'Option 4'] : null,
      correct_answer: ''
    }));
  };

  const handleOptionChange = (index: number, value: string) => {
    if (questionData.options) {
      const newOptions = [...questionData.options];
      newOptions[index] = value;
      setQuestionData((prev: CreateQuizQuestionInput) => ({
        ...prev,
        options: newOptions
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Button variant="ghost" onClick={onBack} className="p-0">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Courses
                </Button>
              </div>
              <CardTitle>Manage Quizzes - {course.title}</CardTitle>
              <CardDescription>Create and manage quizzes for your course</CardDescription>
            </div>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quiz
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Quiz</DialogTitle>
                  <DialogDescription>Add a quiz to assess student learning</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleCreateQuiz} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="quiz-title">Quiz Title</Label>
                    <Input
                      id="quiz-title"
                      value={quizData.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setQuizData((prev: CreateQuizInput) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="Enter quiz title"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="quiz-description">Description (optional)</Label>
                    <Textarea
                      id="quiz-description"
                      value={quizData.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setQuizData((prev: CreateQuizInput) => ({
                          ...prev,
                          description: e.target.value || null
                        }))
                      }
                      placeholder="Quiz description and instructions"
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="passing-score">Passing Score (%)</Label>
                      <Input
                        id="passing-score"
                        type="number"
                        min="1"
                        max="100"
                        value={quizData.passing_score}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setQuizData((prev: CreateQuizInput) => ({
                            ...prev,
                            passing_score: parseInt(e.target.value) || 70
                          }))
                        }
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="time-limit">Time Limit (min)</Label>
                      <Input
                        id="time-limit"
                        type="number"
                        min="1"
                        value={quizData.time_limit_minutes || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setQuizData((prev: CreateQuizInput) => ({
                            ...prev,
                            time_limit_minutes: parseInt(e.target.value) || null
                          }))
                        }
                        placeholder="Optional"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="max-attempts">Max Attempts</Label>
                      <Input
                        id="max-attempts"
                        type="number"
                        min="1"
                        value={quizData.max_attempts || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setQuizData((prev: CreateQuizInput) => ({
                            ...prev,
                            max_attempts: parseInt(e.target.value) || null
                          }))
                        }
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Quiz</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Quizzes List */}
      <div className="space-y-4">
        {quizzes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <HelpCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Quizzes Yet</h3>
              <p className="text-gray-500 mb-4">Create quizzes to assess student knowledge</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Quiz
              </Button>
            </CardContent>
          </Card>
        ) : (
          quizzes.map((quiz: Quiz) => (
            <Card key={quiz.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold">{quiz.title}</h3>
                      <Badge variant={quiz.is_active ? "default" : "secondary"}>
                        {quiz.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    
                    {quiz.description && (
                      <p className="text-gray-600 mb-3">{quiz.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                      <div>
                        <span className="font-medium">Passing Score:</span>
                        <div>{quiz.passing_score}%</div>
                      </div>
                      <div>
                        <span className="font-medium">Time Limit:</span>
                        <div>{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min` : 'Unlimited'}</div>
                      </div>
                      <div>
                        <span className="font-medium">Max Attempts:</span>
                        <div>{quiz.max_attempts || 'Unlimited'}</div>
                      </div>
                      <div>
                        <span className="font-medium">Created:</span>
                        <div>{quiz.created_at.toLocaleDateString()}</div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedQuiz(quiz);
                          setQuestionData((prev: CreateQuizQuestionInput) => ({ ...prev, quiz_id: quiz.id }));
                          setShowQuestionDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Question
                      </Button>
                      
                      <Button size="sm" variant="outline">
                        <FileText className="h-4 w-4 mr-1" />
                        View Questions
                      </Button>
                      
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteQuiz(quiz.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Question Dialog */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add Question to Quiz</DialogTitle>
            <DialogDescription>Create a new question for the selected quiz</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddQuestion} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question-text">Question</Label>
              <Textarea
                id="question-text"
                value={questionData.question_text}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setQuestionData((prev: CreateQuizQuestionInput) => ({ ...prev, question_text: e.target.value }))
                }
                placeholder="Enter your question"
                rows={3}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="question-type">Question Type</Label>
                <Select
                  value={questionData.question_type}
                  onValueChange={handleQuestionTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  min="1"
                  value={questionData.points}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setQuestionData((prev: CreateQuizQuestionInput) => ({
                      ...prev,
                      points: parseInt(e.target.value) || 1
                    }))
                  }
                  required
                />
              </div>
            </div>
            
            {/* Multiple Choice Options */}
            {questionData.question_type === 'multiple_choice' && questionData.options && (
              <div className="space-y-2">
                <Label>Answer Options</Label>
                {questionData.options.map((option: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="text-sm font-medium w-8">{String.fromCharCode(65 + index)}.</span>
                    <Input
                      value={option}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleOptionChange(index, e.target.value)
                      }
                      placeholder={`Option ${index + 1}`}
                      required
                    />
                  </div>
                ))}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="correct-answer">Correct Answer</Label>
              {questionData.question_type === 'multiple_choice' && questionData.options ? (
                <Select
                  value={questionData.correct_answer}
                  onValueChange={(value: string) =>
                    setQuestionData((prev: CreateQuizQuestionInput) => ({ ...prev, correct_answer: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select correct option" />
                  </SelectTrigger>
                  <SelectContent>
                    {questionData.options.map((option: string, index: number) => (
                      <SelectItem key={index} value={option}>
                        {String.fromCharCode(65 + index)}. {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : questionData.question_type === 'true_false' ? (
                <Select
                  value={questionData.correct_answer}
                  onValueChange={(value: string) =>
                    setQuestionData((prev: CreateQuizQuestionInput) => ({ ...prev, correct_answer: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select true or false" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="correct-answer"
                  value={questionData.correct_answer}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setQuestionData((prev: CreateQuizQuestionInput) => ({ ...prev, correct_answer: e.target.value }))
                  }
                  placeholder="Enter the correct answer"
                  required
                />
              )}
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowQuestionDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Question</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}