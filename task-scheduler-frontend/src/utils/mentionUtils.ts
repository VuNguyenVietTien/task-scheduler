/**
 * Utility functions for handling mentions in comments
 */

/**
 * Detects mentions in a comment text
 * @param text The comment text to check for mentions
 * @returns An array of user IDs that were mentioned
 */
export const detectMentions = (text: string): string[] => {
  // Regular expression to match @username or @userId patterns
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = text.match(mentionRegex);
  
  if (!matches) return [];
  
  // Extract the mentioned usernames/userIds
  return matches.map(match => match.substring(1));
};

/**
 * Creates a notification message for a mention
 * @param commenterName The name of the person who made the comment
 * @param taskTitle The title of the task
 * @returns A formatted notification message
 */
export const createMentionMessage = (commenterName: string, taskTitle: string): string => {
  return `${commenterName} mentioned you in a comment on task "${taskTitle}"`;
};

/**
 * Creates a notification title for a mention
 * @param commenterName The name of the person who made the comment
 * @returns A formatted notification title
 */
export const createMentionTitle = (commenterName: string): string => {
  return `Mentioned by ${commenterName}`;
}; 