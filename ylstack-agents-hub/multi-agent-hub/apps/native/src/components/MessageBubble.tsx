import React from 'react';
import { View, Text } from 'react-native';
import type { Message } from '../services/api';

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case 'user':
      return 'You';
    case 'assistant':
      return 'Agent';
    case 'system':
      return 'System';
    default:
      return role;
  }
}

function roleColor(role: string): string {
  switch (role) {
    case 'user':
      return 'bg-blue-600';
    case 'assistant':
      return 'bg-hub-accent';
    case 'system':
      return 'bg-hub-highlight';
    default:
      return 'bg-hub-surface';
  }
}

export default function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const bubbleColor = roleColor(message.role);

  return (
    <View
      className={`px-4 py-2 ${isUser ? 'items-end' : 'items-start'}`}
      style={{ marginBottom: isLast ? 0 : 8 }}
    >
      {/* Role Label */}
      <Text
        className={`text-xs text-hub-text-secondary mb-1 ${
          isUser ? 'text-right mr-1' : 'text-left ml-1'
        }`}
      >
        {roleLabel(message.role)}
      </Text>

      {/* Bubble */}
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${bubbleColor} ${
          isUser ? 'rounded-br-md' : 'rounded-bl-md'
        }`}
      >
        <Text className="text-white text-sm leading-5">{message.content}</Text>
      </View>

      {/* Timestamp */}
      <Text
        className={`text-[10px] text-hub-text-secondary mt-1 ${
          isUser ? 'text-right' : 'text-left'
        }`}
      >
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
}