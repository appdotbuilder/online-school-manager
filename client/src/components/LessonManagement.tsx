import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import { ArrowLeft, Plus, Play, Edit, Trash2, Clock } from 'lucide-react';
import type { Course, Lesson, CreateLessonInput } from '../../../server/src/schema';

interface LessonManagementProps {
  course: Course;
  onBack: () => void;
}

export function LessonManagement({ course, onBack }: LessonManagementProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [lessonData, setLessonData] = useState<CreateLessonInput>({
    course_id: course.id,
    title: '',
    description: null,
    video_url: null,
    content: null,
    order_index: 1,
    duration_minutes: 30
  });

  const loadLessons = useCallback(async () => {
    setIsLoading(true);
    try {
      const lessonsData = await trpc.getLessonsByCourse.query({ courseId: course.id });
      setLessons(lessonsData);
      // Set next order index
      const maxOrder = lessonsData.length > 0 ? Math.max(...lessonsData.map((l: Lesson) => l.order_index)) : 0;
      setLessonData((prev: CreateLessonInput) => ({ ...prev, order_index: maxOrder + 1 }));
    } catch (error) {
      console.error('Failed to load lessons:', error);
    } finally {
      setIsLoading(false);
    }
  }, [course.id]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.createLesson.mutate(lessonData);
      setShowCreateDialog(false);
      setLessonData({
        course_id: course.id,
        title: '',
        description: null,
        video_url: null,
        content: null,
        order_index: lessons.length + 1,
        duration_minutes: 30
      });
      loadLessons();
    } catch (error) {
      console.error('Failed to create lesson:', error);
      alert('Failed to create lesson');
    }
  };

  const handlePublishLesson = async (lessonId: number) => {
    try {
      await trpc.publishLesson.mutate({ lessonId });
      loadLessons();
    } catch (error) {
      console.error('Failed to publish lesson:', error);
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (window.confirm('Are you sure you want to delete this lesson?')) {
      try {
        await trpc.deleteLesson.mutate({ lessonId });
        loadLessons();
      } catch (error) {
        console.error('Failed to delete lesson:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lessons...</p>
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
              <CardTitle>Manage Lessons - {course.title}</CardTitle>
              <CardDescription>Add and organize lessons for your course</CardDescription>
            </div>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lesson
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Lesson</DialogTitle>
                  <DialogDescription>Add a lesson to your course</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleCreateLesson} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="lesson-title">Lesson Title</Label>
                    <Input
                      id="lesson-title"
                      value={lessonData.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setLessonData((prev: CreateLessonInput) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder="Enter lesson title"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lesson-description">Description (optional)</Label>
                    <Textarea
                      id="lesson-description"
                      value={lessonData.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setLessonData((prev: CreateLessonInput) => ({
                          ...prev,
                          description: e.target.value || null
                        }))
                      }
                      placeholder="Lesson description"
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="video-url">Video URL (optional)</Label>
                    <Input
                      id="video-url"
                      type="url"
                      value={lessonData.video_url || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setLessonData((prev: CreateLessonInput) => ({
                          ...prev,
                          video_url: e.target.value || null
                        }))
                      }
                      placeholder="https://example.com/video.mp4"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lesson-content">Text Content (optional)</Label>
                    <Textarea
                      id="lesson-content"
                      value={lessonData.content || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setLessonData((prev: CreateLessonInput) => ({
                          ...prev,
                          content: e.target.value || null
                        }))
                      }
                      placeholder="Lesson content and materials"
                      rows={6}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        min="1"
                        value={lessonData.duration_minutes}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setLessonData((prev: CreateLessonInput) => ({
                            ...prev,
                            duration_minutes: parseInt(e.target.value) || 30
                          }))
                        }
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="order">Order</Label>
                      <Input
                        id="order"
                        type="number"
                        min="1"
                        value={lessonData.order_index}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setLessonData((prev: CreateLessonInput) => ({
                            ...prev,
                            order_index: parseInt(e.target.value) || 1
                          }))
                        }
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Lesson</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Lessons List */}
      <div className="space-y-4">
        {lessons.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Play className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Lessons Yet</h3>
              <p className="text-gray-500 mb-4">Create your first lesson to get started</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Lesson
              </Button>
            </CardContent>
          </Card>
        ) : (
          lessons
            .sort((a: Lesson, b: Lesson) => a.order_index - b.order_index)
            .map((lesson: Lesson) => (
              <Card key={lesson.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Badge variant="outline" className="text-xs">
                          #{lesson.order_index}
                        </Badge>
                        <h3 className="text-lg font-semibold">{lesson.title}</h3>
                        <Badge variant={lesson.is_published ? "default" : "secondary"}>
                          {lesson.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      
                      {lesson.description && (
                        <p className="text-gray-600 mb-3">{lesson.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{lesson.duration_minutes} min</span>
                        </div>
                        {lesson.video_url && (
                          <div className="flex items-center">
                            <Play className="h-4 w-4 mr-1" />
                            <span>Has video</span>
                          </div>
                        )}
                        <span>Created {lesson.created_at.toLocaleDateString()}</span>
                      </div>
                      
                      <div className="flex space-x-2">
                        {!lesson.is_published && (
                          <Button
                            size="sm"
                            onClick={() => handlePublishLesson(lesson.id)}
                          >
                            Publish
                          </Button>
                        )}
                        
                        <Button size="sm" variant="outline">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteLesson(lesson.id)}
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
    </div>
  );
}