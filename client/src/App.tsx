import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/utils/trpc';
import { AuthForm } from '@/components/AuthForm';
import { StudentDashboard } from '@/components/StudentDashboard';
import { InstructorDashboard } from '@/components/InstructorDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';
import { MessagingSystem } from '@/components/MessagingSystem';
import { Badge } from '@/components/ui/badge';
import { Bell, MessageSquare, LogOut, BookOpen } from 'lucide-react';
import type { User, Notification } from '../../server/src/schema';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showMessaging, setShowMessaging] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load user notifications
  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const result = await trpc.getUserNotifications.query();
      setNotifications(result);
      const unread = result.filter((n: Notification) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser, loadNotifications]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    if (currentUser) {
      try {
        await trpc.logout.mutate({ userId: currentUser.id });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    setCurrentUser(null);
    setNotifications([]);
    setUnreadCount(0);
    setShowMessaging(false);
  };

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      await trpc.markNotificationAsRead.mutate({ notificationId });
      setNotifications((prev: Notification[]) =>
        prev.map((n: Notification) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount((prev: number) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <BookOpen className="h-12 w-12 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">EduPlatform</h1>
            <p className="text-gray-600">Your Online Learning Management System</p>
          </div>
          <AuthForm onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  if (showMessaging) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BookOpen className="h-8 w-8 text-indigo-600" />
              <h1 className="text-xl font-semibold">Messages</h1>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowMessaging(false)}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
        <MessagingSystem currentUser={currentUser} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <BookOpen className="h-8 w-8 text-indigo-600" />
            <div>
              <h1 className="text-xl font-semibold">EduPlatform</h1>
              <p className="text-sm text-gray-600">
                Welcome, {currentUser.first_name} {currentUser.last_name}
              </p>
            </div>
            <Badge variant={
              currentUser.role === 'administrator' ? 'destructive' :
              currentUser.role === 'instructor' ? 'secondary' : 'default'
            }>
              {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="relative"
                onClick={() => {
                  // Toggle notification dropdown - for now just show count
                }}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
              
              {/* Simple notification list */}
              {notifications.length > 0 && (
                <Card className="absolute right-0 top-full mt-2 w-80 z-50 max-h-96 overflow-y-auto">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Notifications</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {notifications.slice(0, 5).map((notification: Notification) => (
                      <div
                        key={notification.id}
                        className={`p-2 rounded text-xs cursor-pointer ${
                          notification.is_read ? 'bg-gray-50' : 'bg-blue-50'
                        }`}
                        onClick={() => markNotificationAsRead(notification.id)}
                      >
                        <div className="font-medium">{notification.title}</div>
                        <div className="text-gray-600 mt-1">{notification.message}</div>
                        <div className="text-gray-400 mt-1">
                          {notification.created_at.toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Messages */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMessaging(true)}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>

            {/* Logout */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {currentUser.role === 'student' && <StudentDashboard user={currentUser} />}
        {currentUser.role === 'instructor' && <InstructorDashboard user={currentUser} />}
        {currentUser.role === 'administrator' && <AdminDashboard user={currentUser} />}
      </div>
    </div>
  );
}

export default App;