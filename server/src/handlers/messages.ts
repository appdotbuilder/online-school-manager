import { db } from '../db';
import { messagesTable, notificationsTable, usersTable } from '../db/schema';
import { type SendMessageInput, type Message, type CreateNotificationInput, type Notification } from '../schema';
import { eq, or, desc, asc, and } from 'drizzle-orm';

export async function sendMessage(input: SendMessageInput, senderId: number): Promise<Message> {
  try {
    // First verify that the recipient exists
    const recipient = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.recipient_id))
      .limit(1)
      .execute();

    if (recipient.length === 0) {
      throw new Error('Recipient not found');
    }

    // Insert the message
    const result = await db.insert(messagesTable)
      .values({
        sender_id: senderId,
        recipient_id: input.recipient_id,
        subject: input.subject,
        content: input.content
      })
      .returning()
      .execute();

    const message = result[0];

    // Create a notification for the recipient
    await createNotification({
      user_id: input.recipient_id,
      type: 'message_received',
      title: 'New Message',
      message: `You have received a new message: ${input.subject}`
    });

    return message;
  } catch (error) {
    console.error('Message sending failed:', error);
    throw error;
  }
}

export async function getUserMessages(userId: number, type: 'sent' | 'received'): Promise<Message[]> {
  try {
    const condition = type === 'sent' 
      ? eq(messagesTable.sender_id, userId)
      : eq(messagesTable.recipient_id, userId);

    const messages = await db.select()
      .from(messagesTable)
      .where(condition)
      .orderBy(desc(messagesTable.sent_at))
      .execute();

    return messages;
  } catch (error) {
    console.error('Failed to fetch user messages:', error);
    throw error;
  }
}

export async function getMessageById(messageId: number, userId: number): Promise<Message | null> {
  try {
    // Find message where user is either sender or recipient
    const messages = await db.select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.id, messageId),
          or(
            eq(messagesTable.sender_id, userId),
            eq(messagesTable.recipient_id, userId)
          )
        )
      )
      .limit(1)
      .execute();

    if (messages.length === 0) {
      return null;
    }

    const message = messages[0];

    // If the user is the recipient and the message is unread, mark it as read
    if (message.recipient_id === userId && !message.is_read) {
      const updatedMessages = await db.update(messagesTable)
        .set({ is_read: true })
        .where(eq(messagesTable.id, messageId))
        .returning()
        .execute();

      return updatedMessages[0];
    }

    return message;
  } catch (error) {
    console.error('Failed to fetch message:', error);
    throw error;
  }
}

export async function markMessageAsRead(messageId: number, userId: number): Promise<Message> {
  try {
    // Verify the user is the recipient
    const messages = await db.select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.id, messageId),
          eq(messagesTable.recipient_id, userId)
        )
      )
      .limit(1)
      .execute();

    if (messages.length === 0) {
      throw new Error('Message not found or access denied');
    }

    // Update the message to mark as read
    const updatedMessages = await db.update(messagesTable)
      .set({ is_read: true })
      .where(eq(messagesTable.id, messageId))
      .returning()
      .execute();

    return updatedMessages[0];
  } catch (error) {
    console.error('Failed to mark message as read:', error);
    throw error;
  }
}

export async function deleteMessage(messageId: number, userId: number): Promise<{ success: boolean }> {
  try {
    // Verify the user owns the message (either sender or recipient)
    const messages = await db.select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.id, messageId),
          or(
            eq(messagesTable.sender_id, userId),
            eq(messagesTable.recipient_id, userId)
          )
        )
      )
      .limit(1)
      .execute();

    if (messages.length === 0) {
      throw new Error('Message not found or access denied');
    }

    // Delete the message
    await db.delete(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Failed to delete message:', error);
    throw error;
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  try {
    // Verify that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .limit(1)
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Insert the notification
    const result = await db.insert(notificationsTable)
      .values({
        user_id: input.user_id,
        type: input.type,
        title: input.title,
        message: input.message
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Notification creation failed:', error);
    throw error;
  }
}

export async function getUserNotifications(userId: number): Promise<Notification[]> {
  try {
    // Get notifications ordered by unread first, then by creation date descending
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.user_id, userId))
      .orderBy(asc(notificationsTable.is_read), desc(notificationsTable.created_at))
      .execute();

    return notifications;
  } catch (error) {
    console.error('Failed to fetch user notifications:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: number, userId: number): Promise<Notification> {
  try {
    // Verify the user owns the notification
    const notifications = await db.select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.id, notificationId),
          eq(notificationsTable.user_id, userId)
        )
      )
      .limit(1)
      .execute();

    if (notifications.length === 0) {
      throw new Error('Notification not found or access denied');
    }

    // Update the notification to mark as read
    const updatedNotifications = await db.update(notificationsTable)
      .set({ is_read: true })
      .where(eq(notificationsTable.id, notificationId))
      .returning()
      .execute();

    return updatedNotifications[0];
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId: number): Promise<{ success: boolean; updated: number }> {
  try {
    // Update all unread notifications for the user
    const updatedNotifications = await db.update(notificationsTable)
      .set({ is_read: true })
      .where(
        and(
          eq(notificationsTable.user_id, userId),
          eq(notificationsTable.is_read, false)
        )
      )
      .returning()
      .execute();

    return { 
      success: true, 
      updated: updatedNotifications.length 
    };
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw error;
  }
}