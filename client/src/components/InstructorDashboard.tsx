import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import { CourseManagement } from '@/components/CourseManagement';
import { LessonManagement } from '@/components/LessonManagement';
import { QuizManagement } from '@/components/QuizManagement';
import { 
  BookOpen, 
  Users, 
  TrendingUp, 
  DollarSign,
  Plus,
  Eye,
  Edit,
  BarChart3,
  PlayCircle,
  FileText,
  Award
} from 'lucide-react';
import type { User, Course, Enrollment } from '../../../server/src/schema';

interface InstructorDashboardProps {
  user: User;
}

export function InstructorDashboard({ user }: InstructorDashboardProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [showLessonManagement, setShowLessonManagement] = useState(false);
  const [showQuizManagement, setShowQuizManagement] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCourses: 0,
    publishedCourses: 0,
    totalStudents: 0,
    totalRevenue: 0
  });

  // Load instructor data
  const loadInstructorData = useCallback(async () => {
    setIsLoading(true);
    try {
      const coursesData = await trpc.getInstructorCourses.query({ instructorId: user.id });
      setCourses(coursesData);

      // Calculate stats
      const publishedCount = coursesData.filter((c: Course) => c.is_published).length;
      let totalStudents = 0;
      
      // Get enrollment data for each course
      for (const course of coursesData) {
        try {
          const enrollments = await trpc.getCourseEnrollments.query({ courseId: course.id });
          totalStudents += enrollments.length;
        } catch (error) {
          console.error(`Failed to load enrollments for course ${course.id}:`, error);
        }
      }

      setStats({
        totalCourses: coursesData.length,
        publishedCourses: publishedCount,
        totalStudents,
        totalRevenue: 0 // TODO: Calculate from payment data
      });
    } catch (error) {
      console.error('Failed to load instructor data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadInstructorData();
  }, [loadInstructorData]);

  const handleCourseCreated = () => {
    setShowCourseDialog(false);
    loadInstructorData();
  };

  const handlePublishCourse = async (courseId: number) => {
    try {
      await trpc.publishCourse.mutate({ courseId });
      loadInstructorData();
    } catch (error) {
      console.error('Failed to publish course:', error);
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
    if (window.confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      try {
        await trpc.deleteCourse.mutate({ courseId });
        loadInstructorData();
      } catch (error) {
        console.error('Failed to delete course:', error);
      }
    }
  };

  if (showLessonManagement && selectedCourse) {
    return (
      <LessonManagement
        course={selectedCourse}
        onBack={() => {
          setShowLessonManagement(false);
          setSelectedCourse(null);
        }}
      />
    );
  }

  if (showQuizManagement && selectedCourse) {
    return (
      <QuizManagement
        course={selectedCourse}
        onBack={() => {
          setShowQuizManagement(false);
          setSelectedCourse(null);
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your instructor dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">Instructor Panel 👩‍🏫</h2>
        <p className="opacity-90">Manage your courses and track student progress</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCourses}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.publishedCourses}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalStudents}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${stats.totalRevenue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="courses" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="courses">My Courses</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Course
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Course</DialogTitle>
                <DialogDescription>
                  Fill in the details to create a new course
                </DialogDescription>
              </DialogHeader>
              <CourseManagement onCourseCreated={handleCourseCreated} />
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="courses" className="space-y-4">
          {courses.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No courses created yet</p>
                <Button onClick={() => setShowCourseDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Course
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {courses.map((course: Course) => (
                <Card key={course.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-xl font-semibold">{course.title}</h3>
                        <Badge variant={course.is_published ? "default" : "secondary"}>
                          {course.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      
                      <p className="text-gray-600 mb-4">{course.description}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
                        <span>${course.price}</span>
                        <span>•</span>
                        <span>{course.duration_hours}h duration</span>
                        <span>•</span>
                        <span>Created {course.created_at.toLocaleDateString()}</span>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCourse(course);
                            setShowLessonManagement(true);
                          }}
                        >
                          <PlayCircle className="h-4 w-4 mr-1" />
                          Manage Lessons
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCourse(course);
                            setShowQuizManagement(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Manage Quizzes
                        </Button>
                        
                        {!course.is_published && (
                          <Button
                            size="sm"
                            onClick={() => handlePublishCourse(course.id)}
                          >
                            Publish Course
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteCourse(course.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {course.thumbnail_url && (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-32 h-20 object-cover rounded ml-6"
                      />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Course Performance</CardTitle>
                <CardDescription>Overview of your course statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Analytics coming soon...</p>
                </div>
              </CardContent>
            </Card>
            
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Student Engagement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{stats.totalStudents}</p>
                    <p className="text-gray-500">Total Enrolled</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Completion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <Award className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">--</p>
                    <p className="text-gray-500">Coming Soon</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}