import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Pause, Volume2, Maximize, CheckCircle } from 'lucide-react';

interface Lesson {
  id: number;
  course_id: number;
  title: string;
  description?: string | null;
  video_url?: string | null;
  content?: string | null;
  duration_minutes: number;
}

interface VideoPlayerProps {
  lesson: Lesson;
  onComplete: (lessonId: number, watchTime: number) => void;
  onBack: () => void;
}

export function VideoPlayer({ lesson, onComplete, onBack }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(lesson.duration_minutes * 60); // Convert to seconds
  const [watchTime, setWatchTime] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Simulate video progress
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const newTime = prev + 1;
          setWatchTime((watchPrev) => watchPrev + 1);
          
          // Auto-complete when 80% watched
          if (newTime >= duration * 0.8 && !isCompleted) {
            setIsCompleted(true);
            setIsPlaying(false);
          }
          
          return newTime >= duration ? duration : newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, duration, isCompleted]);

  const handleComplete = () => {
    onComplete(lesson.id, watchTime);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (currentTime / duration) * 100;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{lesson.title}</h1>
              <p className="text-sm text-gray-600">Course ID: {lesson.course_id}</p>
            </div>
          </div>
          {isCompleted && (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="h-4 w-4 mr-1" />
              Completed
            </Badge>
          )}
        </div>
      </div>

      {/* Video Player */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-0">
              {/* Video Area */}
              <div className="relative bg-black aspect-video flex items-center justify-center">
                {lesson.video_url ? (
                  <div className="text-white text-center">
                    <div className="text-6xl mb-4">🎥</div>
                    <p className="text-xl">Video Player</p>
                    <p className="text-gray-400">Playing: {lesson.title}</p>
                  </div>
                ) : (
                  <div className="text-white text-center">
                    <div className="text-6xl mb-4">📖</div>
                    <p className="text-xl">Text-based Lesson</p>
                  </div>
                )}

                {/* Play/Pause Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="rounded-full w-16 h-16"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
                  </Button>
                </div>
              </div>

              {/* Video Controls */}
              <div className="bg-gray-800 p-4 text-white">
                <div className="space-y-3">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <Progress value={progressPercentage} className="bg-gray-700" />
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsPlaying(!isPlaying)}
                      >
                        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Volume2 className="h-5 w-5" />
                      </Button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">
                        Watch time: {formatTime(watchTime)}
                      </span>
                      <Button variant="ghost" size="sm">
                        <Maximize className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lesson Content */}
          {lesson.description && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Lesson Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{lesson.description}</p>
              </CardContent>
            </Card>
          )}

          {lesson.content && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Lesson Content</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-line">{lesson.content}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Complete Lesson Button */}
          {(progressPercentage >= 80 || isCompleted) && (
            <Card className="mt-6 bg-green-50 border-green-200">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  {isCompleted ? 'Lesson Completed!' : 'Ready to Complete?'}
                </h3>
                <p className="text-green-700 mb-4">
                  {isCompleted 
                    ? 'Great job! You have successfully completed this lesson.' 
                    : 'You\'ve watched enough to mark this lesson as complete.'}
                </p>
                <Button 
                  onClick={handleComplete}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isCompleted}
                >
                  {isCompleted ? 'Completed ✅' : 'Mark as Complete'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}