import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Clock, DollarSign, Users, BookOpen } from 'lucide-react';
import type { Course } from '../../../server/src/schema';

interface CourseGridProps {
  courses: Course[];
  enrolledCourseIds?: number[];
  onEnroll?: (courseId: number) => void;
  userRole: 'student' | 'instructor' | 'administrator';
}

export function CourseGrid({ courses, enrolledCourseIds = [], onEnroll, userRole }: CourseGridProps) {
  if (courses.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Courses Available</h3>
          <p className="text-gray-500">Check back later for new courses!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map((course: Course) => {
        const isEnrolled = enrolledCourseIds.includes(course.id);
        
        return (
          <Card key={course.id} className="hover:shadow-lg transition-shadow duration-200">
            {course.thumbnail_url && (
              <div className="relative">
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
                <div className="absolute top-2 right-2">
                  <Badge variant={course.is_published ? "default" : "secondary"}>
                    {course.is_published ? 'Published' : 'Draft'}
                  </Badge>
                </div>
              </div>
            )}
            
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg line-clamp-2">{course.title}</CardTitle>
                  <CardDescription className="mt-2 line-clamp-3">
                    {course.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Course Stats */}
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{course.duration_hours}h</span>
                    </div>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-400" />
                      <span>4.8</span>
                    </div>
                  </div>
                  <div className="flex items-center font-semibold text-green-600">
                    <DollarSign className="h-4 w-4" />
                    <span>{course.price === 0 ? 'Free' : course.price}</span>
                  </div>
                </div>
                
                {/* Instructor Info */}
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="h-4 w-4 mr-1" />
                  <span>Instructor ID: {course.instructor_id}</span>
                </div>
                
                {/* Action Button */}
                {userRole === 'student' && (
                  <div className="pt-2">
                    {isEnrolled ? (
                      <Badge variant="default" className="w-full justify-center py-2">
                        ✅ Enrolled
                      </Badge>
                    ) : (
                      <Button 
                        className="w-full" 
                        onClick={() => onEnroll?.(course.id)}
                        disabled={!course.is_published}
                      >
                        {course.price === 0 ? 'Enroll Free' : `Enroll for $${course.price}`}
                      </Button>
                    )}
                  </div>
                )}
                
                {/* Creation Date */}
                <div className="text-xs text-gray-400 pt-2 border-t">
                  Created {course.created_at.toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}