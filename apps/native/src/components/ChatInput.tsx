import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';

interface ChatInputProps {
  onSend: (text: string) => void;
  isSending?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  isSending = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    onSend(trimmed);
    setText('');
    Keyboard.dismiss();
  };

  const canSend = text.trim().length > 0 && !isSending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View className="flex-row items-end px-4 py-3 bg-hub-card border-t border-hub-border">
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#6b7280"
          multiline
          maxLength={4000}
          className="flex-1 bg-hub-surface text-hub-text rounded-xl px-4 py-3 max-h-32 text-base leading-5"
          style={{ textAlignVertical: 'center' }}
          editable={!isSending}
        />

        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          className={`ml-2 w-12 h-12 rounded-full items-center justify-center ${
            canSend ? 'bg-hub-highlight' : 'bg-hub-surface'
          }`}
        >
          {isSending ? (
            <Text className="text-white text-lg">...</Text>
          ) : (
            <Text className={`text-lg ${canSend ? 'text-white' : 'text-hub-text-secondary'}`}>
              {'->'}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}