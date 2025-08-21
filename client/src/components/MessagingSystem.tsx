import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import { 
  MessageSquare, 
  Send, 
  Inbox, 
  Plus,
  Reply,
  Trash2,
  Eye
} from 'lucide-react';
import type { User, Message, SendMessageInput } from '../../../server/src/schema';

interface MessagingSystemProps {
  currentUser: User;
}

export function MessagingSystem({ currentUser }: MessagingSystemProps) {
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [composeData, setComposeData] = useState<SendMessageInput>({
    recipient_id: 0,
    subject: '',
    content: ''
  });

  // Load messages
  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const [received, sent] = await Promise.all([
        trpc.getUserMessages.query({ type: 'received' }),
        trpc.getUserMessages.query({ type: 'sent' })
      ]);
      
      setReceivedMessages(received);
      setSentMessages(sent);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.sendMessage.mutate(composeData);
      setShowCompose(false);
      setComposeData({
        recipient_id: 0,
        subject: '',
        content: ''
      });
      loadMessages(); // Refresh messages
      alert('Message sent successfully!');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  };

  const handleMarkAsRead = async (messageId: number) => {
    try {
      await trpc.markMessageAsRead.mutate({ messageId });
      setReceivedMessages((prev: Message[]) =>
        prev.map((msg: Message) =>
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      );
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await trpc.deleteMessage.mutate({ messageId });
        loadMessages();
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
    }
  };

  const handleReply = (message: Message) => {
    setComposeData({
      recipient_id: message.sender_id,
      subject: message.subject.startsWith('Re: ') ? message.subject : `Re: ${message.subject}`,
      content: `\n\n--- Original Message ---\n${message.content}`
    });
    setShowCompose(true);
  };

  const MessageList = ({ messages, type }: { messages: Message[], type: 'received' | 'sent' }) => (
    <div className="space-y-2">
      {messages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p>No {type} messages</p>
        </div>
      ) : (
        messages.map((message: Message) => (
          <Card
            key={message.id}
            className={`cursor-pointer transition-colors hover:bg-gray-50 ${
              type === 'received' && !message.is_read ? 'border-blue-200 bg-blue-50' : ''
            }`}
            onClick={() => {
              setSelectedMessage(message);
              if (type === 'received' && !message.is_read) {
                handleMarkAsRead(message.id);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">
                    {type === 'received' ? `From: User #${message.sender_id}` : `To: User #${message.recipient_id}`}
                  </span>
                  {type === 'received' && !message.is_read && (
                    <Badge variant="default" className="text-xs">New</Badge>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {message.sent_at.toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-semibold mb-1">{message.subject}</h3>
              <p className="text-gray-600 text-sm line-clamp-2">
                {message.content}
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  if (selectedMessage) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Message Header */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setSelectedMessage(null)}
                >
                  ← Back to Messages
                </Button>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReply(selectedMessage)}
                  >
                    <Reply className="h-4 w-4 mr-1" />
                    Reply
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteMessage(selectedMessage.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Message Content */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedMessage.subject}</CardTitle>
              <CardDescription>
                From: User #{selectedMessage.sender_id} • 
                Sent: {selectedMessage.sent_at.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <p className="whitespace-pre-line text-gray-700">
                  {selectedMessage.content}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-6 w-6 mr-2" />
                  Messages
                </CardTitle>
                <CardDescription>Send and receive messages</CardDescription>
              </div>
              
              <Dialog open={showCompose} onOpenChange={setShowCompose}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Compose
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Compose Message</DialogTitle>
                    <DialogDescription>Send a message to another user</DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={handleSendMessage} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="recipient">Recipient ID</Label>
                      <Input
                        id="recipient"
                        type="number"
                        value={composeData.recipient_id || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setComposeData((prev: SendMessageInput) => ({
                            ...prev,
                            recipient_id: parseInt(e.target.value) || 0
                          }))
                        }
                        placeholder="Enter user ID"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={composeData.subject}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setComposeData((prev: SendMessageInput) => ({
                            ...prev,
                            subject: e.target.value
                          }))
                        }
                        placeholder="Message subject"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="content">Message</Label>
                      <Textarea
                        id="content"
                        rows={6}
                        value={composeData.content}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setComposeData((prev: SendMessageInput) => ({
                            ...prev,
                            content: e.target.value
                          }))
                        }
                        placeholder="Type your message here..."
                        required
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setShowCompose(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
        </Card>

        {/* Messages Content */}
        <Tabs defaultValue="received" className="space-y-4">
          <TabsList>
            <TabsTrigger value="received" className="flex items-center">
              <Inbox className="h-4 w-4 mr-2" />
              Inbox ({receivedMessages.filter((m: Message) => !m.is_read).length})
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex items-center">
              <Send className="h-4 w-4 mr-2" />
              Sent ({sentMessages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received">
            <Card>
              <CardHeader>
                <CardTitle>Received Messages</CardTitle>
                <CardDescription>Messages you have received</CardDescription>
              </CardHeader>
              <CardContent>
                <MessageList messages={receivedMessages} type="received" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sent">
            <Card>
              <CardHeader>
                <CardTitle>Sent Messages</CardTitle>
                <CardDescription>Messages you have sent</CardDescription>
              </CardHeader>
              <CardContent>
                <MessageList messages={sentMessages} type="sent" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}