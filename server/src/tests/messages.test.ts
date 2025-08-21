import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, messagesTable, notificationsTable } from '../db/schema';
import { type SendMessageInput, type CreateNotificationInput } from '../schema';
import {
  sendMessage,
  getUserMessages,
  getMessageById,
  markMessageAsRead,
  deleteMessage,
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../handlers/messages';
import { eq, and } from 'drizzle-orm';

// Test users
const testSender = {
  email: 'sender@test.com',
  password_hash: 'hashedpassword123',
  first_name: 'John',
  last_name: 'Sender',
  role: 'instructor' as const
};

const testRecipient = {
  email: 'recipient@test.com',
  password_hash: 'hashedpassword456',
  first_name: 'Jane',
  last_name: 'Recipient',
  role: 'student' as const
};

// Test message input
const testMessageInput: SendMessageInput = {
  recipient_id: 0, // Will be set after creating users
  subject: 'Test Subject',
  content: 'This is a test message content.'
};

// Test notification input
const testNotificationInput: CreateNotificationInput = {
  user_id: 0, // Will be set after creating users
  type: 'course_update',
  title: 'Test Notification',
  message: 'This is a test notification message.'
};

describe('messages handlers', () => {
  let senderId: number;
  let recipientId: number;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const senderResult = await db.insert(usersTable)
      .values(testSender)
      .returning()
      .execute();

    const recipientResult = await db.insert(usersTable)
      .values(testRecipient)
      .returning()
      .execute();

    senderId = senderResult[0].id;
    recipientId = recipientResult[0].id;

    // Update test inputs with real user IDs
    testMessageInput.recipient_id = recipientId;
    testNotificationInput.user_id = recipientId;
  });

  afterEach(resetDB);

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      const result = await sendMessage(testMessageInput, senderId);

      expect(result.sender_id).toEqual(senderId);
      expect(result.recipient_id).toEqual(recipientId);
      expect(result.subject).toEqual('Test Subject');
      expect(result.content).toEqual('This is a test message content.');
      expect(result.is_read).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.sent_at).toBeInstanceOf(Date);
    });

    it('should save message to database', async () => {
      const result = await sendMessage(testMessageInput, senderId);

      const messages = await db.select()
        .from(messagesTable)
        .where(eq(messagesTable.id, result.id))
        .execute();

      expect(messages).toHaveLength(1);
      expect(messages[0].sender_id).toEqual(senderId);
      expect(messages[0].recipient_id).toEqual(recipientId);
      expect(messages[0].subject).toEqual('Test Subject');
      expect(messages[0].content).toEqual('This is a test message content.');
    });

    it('should create notification for recipient', async () => {
      await sendMessage(testMessageInput, senderId);

      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.user_id, recipientId))
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toEqual('message_received');
      expect(notifications[0].title).toEqual('New Message');
      expect(notifications[0].message).toContain('Test Subject');
    });

    it('should throw error for non-existent recipient', async () => {
      const invalidInput = { ...testMessageInput, recipient_id: 99999 };

      await expect(sendMessage(invalidInput, senderId)).rejects.toThrow(/recipient not found/i);
    });
  });

  describe('getUserMessages', () => {
    it('should fetch sent messages', async () => {
      // Send a message
      await sendMessage(testMessageInput, senderId);

      const sentMessages = await getUserMessages(senderId, 'sent');

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].sender_id).toEqual(senderId);
      expect(sentMessages[0].subject).toEqual('Test Subject');
    });

    it('should fetch received messages', async () => {
      // Send a message
      await sendMessage(testMessageInput, senderId);

      const receivedMessages = await getUserMessages(recipientId, 'received');

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].recipient_id).toEqual(recipientId);
      expect(receivedMessages[0].subject).toEqual('Test Subject');
    });

    it('should return empty array for users with no messages', async () => {
      const messages = await getUserMessages(senderId, 'received');

      expect(messages).toHaveLength(0);
    });

    it('should order messages by date descending', async () => {
      // Send multiple messages with slight delay
      const message1 = await sendMessage(testMessageInput, senderId);
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const message2Input = { ...testMessageInput, subject: 'Second Message' };
      const message2 = await sendMessage(message2Input, senderId);

      const messages = await getUserMessages(senderId, 'sent');

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toEqual(message2.id); // More recent first
      expect(messages[1].id).toEqual(message1.id);
    });
  });

  describe('getMessageById', () => {
    it('should fetch message for sender', async () => {
      const sentMessage = await sendMessage(testMessageInput, senderId);

      const result = await getMessageById(sentMessage.id, senderId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(sentMessage.id);
      expect(result!.subject).toEqual('Test Subject');
    });

    it('should fetch message for recipient', async () => {
      const sentMessage = await sendMessage(testMessageInput, senderId);

      const result = await getMessageById(sentMessage.id, recipientId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(sentMessage.id);
      expect(result!.subject).toEqual('Test Subject');
    });

    it('should mark message as read when recipient views it', async () => {
      const sentMessage = await sendMessage(testMessageInput, senderId);

      const result = await getMessageById(sentMessage.id, recipientId);

      expect(result!.is_read).toBe(true);

      // Verify in database
      const dbMessage = await db.select()
        .from(messagesTable)
        .where(eq(messagesTable.id, sentMessage.id))
        .execute();

      expect(dbMessage[0].is_read).toBe(true);
    });

    it('should not mark message as read when sender views it', async () => {
      const sentMessage = await sendMessage(testMessageInput, senderId);

      await getMessageById(sentMessage.id, senderId);

      // Verify still unread in database
      const dbMessage = await db.select()
        .from(messagesTable)
        .where(eq(messagesTable.id, sentMessage.id))
        .execute();

      expect(dbMessage[0].is_read).toBe(false);
    });

    it('should return null for non-existent message', async () => {
      const result = await getMessageById(99999, senderId);

      expect(result).toBeNull();
    });

    it('should return null for message user cannot access', async () => {
      // Create another user
      const otherUser = await db.insert(usersTable)
        .values({
          email: 'other@test.com',
          password_hash: 'password',
          first_name: 'Other',
          last_name: 'User',
          role: 'student'
        })
        .returning()
        .execute();

      const sentMessage = await sendMessage(testMessageInput, senderId);
      const result = await getMessageById(sentMessage.id, otherUser[0].id);

      expect(result).toBeNull();
    });
  });

  describe('markMessageAsRead', () => {
    it('should mark message as read for recipient', async () => {
      const sentMessage = await sendMessage(testMessageInput, senderId);

      const result = await markMessageAsRead(sentMessage.id, recipientId);

      expect(result.is_read).toBe(true);
      expect(result.id).toEqual(sentMessage.id);
    });

    it('should update message in database', async () => {
      const sentMessage = await sendMessage(testMessageInput, senderId);

      await markMessageAsRead(sentMessage.id, recipientId);

      const dbMessage = await db.select()
        .from(messagesTable)
        .where(eq(messagesTable.id, sentMessage.id))
        .execute();

      expect(dbMessage[0].is_read).toBe(true);
    });

    it('should throw error if user is not recipient', async () => {
      const sentMessage = await sendMessage(testMessageInput, senderId);

      await expect(markMessageAsRead(sentMessage.id, senderId))
        .rejects.toThrow(/not found or access denied/i);
    });

    it('should throw error for non-existent message', async () => {
      await expect(markMessageAsRead(99999, recipientId))
        .rejects.toThrow(/not found or access denied/i);
    });
  });

  describe('deleteMessage', () => {
    it('should delete message for sender', async () => {
      const sentMessage = await sendMessage(testMessageInput, senderId);

      const result = await deleteMessage(sentMessage.id, senderId);

      expect(result.success).toBe(true);

      // Verify message is deleted
      const dbMessages = await db.select()
        .from(messagesTable)
        .where(eq(messagesTable.id, sentMessage.id))
        .execute();

      expect(dbMessages).toHaveLength(0);
    });

    it('should delete message for recipient', async () => {
      const sentMessage = await sendMessage(testMessageInput, senderId);

      const result = await deleteMessage(sentMessage.id, recipientId);

      expect(result.success).toBe(true);

      // Verify message is deleted
      const dbMessages = await db.select()
        .from(messagesTable)
        .where(eq(messagesTable.id, sentMessage.id))
        .execute();

      expect(dbMessages).toHaveLength(0);
    });

    it('should throw error for unauthorized user', async () => {
      // Create another user
      const otherUser = await db.insert(usersTable)
        .values({
          email: 'other@test.com',
          password_hash: 'password',
          first_name: 'Other',
          last_name: 'User',
          role: 'student'
        })
        .returning()
        .execute();

      const sentMessage = await sendMessage(testMessageInput, senderId);

      await expect(deleteMessage(sentMessage.id, otherUser[0].id))
        .rejects.toThrow(/not found or access denied/i);
    });

    it('should throw error for non-existent message', async () => {
      await expect(deleteMessage(99999, senderId))
        .rejects.toThrow(/not found or access denied/i);
    });
  });

  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      const result = await createNotification(testNotificationInput);

      expect(result.user_id).toEqual(recipientId);
      expect(result.type).toEqual('course_update');
      expect(result.title).toEqual('Test Notification');
      expect(result.message).toEqual('This is a test notification message.');
      expect(result.is_read).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save notification to database', async () => {
      const result = await createNotification(testNotificationInput);

      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, result.id))
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].user_id).toEqual(recipientId);
      expect(notifications[0].type).toEqual('course_update');
      expect(notifications[0].title).toEqual('Test Notification');
    });

    it('should throw error for non-existent user', async () => {
      const invalidInput = { ...testNotificationInput, user_id: 99999 };

      await expect(createNotification(invalidInput)).rejects.toThrow(/user not found/i);
    });
  });

  describe('getUserNotifications', () => {
    it('should fetch user notifications', async () => {
      await createNotification(testNotificationInput);

      const notifications = await getUserNotifications(recipientId);

      expect(notifications).toHaveLength(1);
      expect(notifications[0].user_id).toEqual(recipientId);
      expect(notifications[0].type).toEqual('course_update');
    });

    it('should return empty array for user with no notifications', async () => {
      const notifications = await getUserNotifications(senderId);

      expect(notifications).toHaveLength(0);
    });

    it('should order notifications with unread first', async () => {
      // Create read notification
      const readNotification = await createNotification(testNotificationInput);
      await markNotificationAsRead(readNotification.id, recipientId);

      // Create unread notification
      const unreadInput = { 
        ...testNotificationInput, 
        title: 'Unread Notification',
        type: 'quiz_available' as const
      };
      await createNotification(unreadInput);

      const notifications = await getUserNotifications(recipientId);

      expect(notifications).toHaveLength(2);
      expect(notifications[0].is_read).toBe(false); // Unread first
      expect(notifications[1].is_read).toBe(true);
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read', async () => {
      const notification = await createNotification(testNotificationInput);

      const result = await markNotificationAsRead(notification.id, recipientId);

      expect(result.is_read).toBe(true);
      expect(result.id).toEqual(notification.id);
    });

    it('should update notification in database', async () => {
      const notification = await createNotification(testNotificationInput);

      await markNotificationAsRead(notification.id, recipientId);

      const dbNotification = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, notification.id))
        .execute();

      expect(dbNotification[0].is_read).toBe(true);
    });

    it('should throw error for unauthorized user', async () => {
      const notification = await createNotification(testNotificationInput);

      await expect(markNotificationAsRead(notification.id, senderId))
        .rejects.toThrow(/not found or access denied/i);
    });

    it('should throw error for non-existent notification', async () => {
      await expect(markNotificationAsRead(99999, recipientId))
        .rejects.toThrow(/not found or access denied/i);
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      // Create multiple notifications
      await createNotification(testNotificationInput);
      const secondInput = { 
        ...testNotificationInput, 
        title: 'Second Notification',
        type: 'quiz_available' as const
      };
      await createNotification(secondInput);

      const result = await markAllNotificationsAsRead(recipientId);

      expect(result.success).toBe(true);
      expect(result.updated).toEqual(2);

      // Verify all are read
      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.user_id, recipientId))
        .execute();

      notifications.forEach(notification => {
        expect(notification.is_read).toBe(true);
      });
    });

    it('should not update already read notifications', async () => {
      // Create and mark one notification as read
      const notification = await createNotification(testNotificationInput);
      await markNotificationAsRead(notification.id, recipientId);

      // Create another unread notification
      const secondInput = { 
        ...testNotificationInput, 
        title: 'Unread Notification',
        type: 'quiz_available' as const
      };
      await createNotification(secondInput);

      const result = await markAllNotificationsAsRead(recipientId);

      expect(result.success).toBe(true);
      expect(result.updated).toEqual(1); // Only one was updated
    });

    it('should return zero updated for user with no unread notifications', async () => {
      const result = await markAllNotificationsAsRead(recipientId);

      expect(result.success).toBe(true);
      expect(result.updated).toEqual(0);
    });
  });
});