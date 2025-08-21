import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import { CourseGrid } from '@/components/CourseGrid';
import { VideoPlayer } from '@/components/VideoPlayer';
import { QuizSystem } from '@/components/QuizSystem';
import { CertificateDisplay } from '@/components/CertificateDisplay';
import { 
  BookOpen, 
  Award, 
  Clock, 
  CheckCircle, 
  TrendingUp,
  Play,
  Trophy,
  Target
} from 'lucide-react';
import type { User, Course, Enrollment, Certificate, LessonProgress } from '../../../server/src/schema';

interface StudentDashboardProps {
  user: User;
}

export function StudentDashboard({ user }: StudentDashboardProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    totalWatchTime: 0,
    certificatesEarned: 0
  });

  // Load student data
  const loadStudentData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [enrollmentsData, coursesData, certificatesData] = await Promise.all([
        trpc.getStudentEnrollments.query(),
        trpc.getCourses.query(),
        trpc.getStudentCertificates.query()
      ]);

      setEnrollments(enrollmentsData);
      setAvailableCourses(coursesData);
      setCertificates(certificatesData);

      // Calculate stats
      const completedCount = enrollmentsData.filter((e: Enrollment) => e.is_completed).length;
      setStats({
        totalCourses: enrollmentsData.length,
        completedCourses: completedCount,
        totalWatchTime: 0, // TODO: Calculate from lesson progress
        certificatesEarned: certificatesData.length
      });
    } catch (error) {
      console.error('Failed to load student data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  const handleEnrollInCourse = async (courseId: number) => {
    try {
      await trpc.enrollInCourse.mutate({ course_id: courseId });
      loadStudentData(); // Refresh data
    } catch (error) {
      console.error('Failed to enroll in course:', error);
    }
  };

  const handleStartLesson = (lesson: any) => {
    setCurrentLesson(lesson);
    setShowVideoPlayer(true);
  };

  const handleStartQuiz = (quiz: any) => {
    setCurrentQuiz(quiz);
    setShowQuiz(true);
  };

  const handleLessonComplete = async (lessonId: number, watchTime: number) => {
    try {
      await trpc.updateProgress.mutate({
        lesson_id: lessonId,
        watch_time_seconds: watchTime,
        is_completed: true
      });
      loadStudentData(); // Refresh progress
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  if (showVideoPlayer && currentLesson) {
    return (
      <VideoPlayer
        lesson={currentLesson}
        onComplete={handleLessonComplete}
        onBack={() => {
          setShowVideoPlayer(false);
          setCurrentLesson(null);
        }}
      />
    );
  }

  if (showQuiz && currentQuiz) {
    return (
      <QuizSystem
        quiz={currentQuiz}
        onComplete={() => {
          setShowQuiz(false);
          setCurrentQuiz(null);
          loadStudentData();
        }}
        onBack={() => {
          setShowQuiz(false);
          setCurrentQuiz(null);
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">Welcome back, {user.first_name}! 📚</h2>
        <p className="opacity-90">Ready to continue your learning journey?</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrolled Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCourses}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedCourses}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.certificatesEarned}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalCourses > 0 ? Math.round((stats.completedCourses / stats.totalCourses) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="learning" className="space-y-4">
        <TabsList>
          <TabsTrigger value="learning">My Learning</TabsTrigger>
          <TabsTrigger value="courses">All Courses</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="learning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Enrolled Courses</CardTitle>
              <CardDescription>Continue where you left off</CardDescription>
            </CardHeader>
            <CardContent>
              {enrollments.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No courses enrolled yet</p>
                  <Button onClick={() => {
                    const coursesTab = document.querySelector('[data-value="courses"]') as HTMLElement;
                    coursesTab?.click();
                  }}>
                    Browse Courses
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {enrollments.map((enrollment: Enrollment) => {
                    const course = availableCourses.find((c: Course) => c.id === enrollment.course_id);
                    if (!course) return null;

                    return (
                      <Card key={enrollment.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{course.title}</h3>
                            <p className="text-gray-600 text-sm mb-2">{course.description}</p>
                            
                            <div className="flex items-center space-x-4 mb-3">
                              <Badge variant={enrollment.is_completed ? "default" : "secondary"}>
                                {enrollment.is_completed ? 'Completed' : 'In Progress'}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                Progress: {enrollment.progress_percentage}%
                              </span>
                            </div>
                            
                            <Progress value={enrollment.progress_percentage} className="mb-3" />
                            
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  // For demo, we'll use placeholder lesson data
                                  const demoLesson = {
                                    id: 1,
                                    course_id: course.id,
                                    title: `${course.title} - Lesson 1`,
                                    video_url: 'https://example.com/video.mp4',
                                    duration_minutes: 30
                                  };
                                  handleStartLesson(demoLesson);
                                }}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Continue Learning
                              </Button>
                              
                              {enrollment.progress_percentage > 80 && !enrollment.is_completed && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await trpc.completeCourse.mutate({ courseId: course.id });
                                      loadStudentData();
                                    } catch (error) {
                                      console.error('Failed to complete course:', error);
                                    }
                                  }}
                                >
                                  Complete Course
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {course.thumbnail_url && (
                            <img
                              src={course.thumbnail_url}
                              alt={course.title}
                              className="w-24 h-16 object-cover rounded ml-4"
                            />
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses">
          <CourseGrid
            courses={availableCourses}
            enrolledCourseIds={enrollments.map((e: Enrollment) => e.course_id)}
            onEnroll={handleEnrollInCourse}
            userRole="student"
          />
        </TabsContent>

        <TabsContent value="certificates">
          <Card>
            <CardHeader>
              <CardTitle>Your Certificates</CardTitle>
              <CardDescription>Showcase your achievements</CardDescription>
            </CardHeader>
            <CardContent>
              {certificates.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No certificates earned yet</p>
                  <p className="text-sm text-gray-400">Complete courses to earn certificates</p>
                </div>
              ) : (
                <CertificateDisplay certificates={certificates} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}