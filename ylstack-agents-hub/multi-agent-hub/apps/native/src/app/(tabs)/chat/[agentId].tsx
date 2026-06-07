import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAppStore } from '../../../store/appStore';
import MessageBubble from '../../../components/MessageBubble';
import ChatInput from '../../../components/ChatInput';
import { useChat } from '../../../hooks/useChat';
import type { Message } from '../../../services/api';

export default function AgentChatScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const theme = useAppStore((s) => s.theme);
  const agents = useAppStore((s) => s.agents);
  const isDark = theme === 'dark';

  const agent = agents.find((a) => a.id === agentId);
  const flatListRef = useRef<FlatList<Message>>(null);
  const { messages, isLoading, isSending, sendMessage, clearConversation } =
    useChat(agentId ?? '');

  const handleSend = useCallback(
    async (text: string) => {
      try {
        await sendMessage(text);
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String(err.message)
            : 'Failed to send message';
        console.error('Send error:', msg);
      }
    },
    [sendMessage]
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => (
      <MessageBubble message={item} isLast={index === messages.length - 1} />
    ),
    [messages.length]
  );

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-hub-dark' : 'bg-gray-50'}`}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
      <View
        className={`px-4 py-3 border-b flex-row items-center ${
          isDark ? 'border-hub-border' : 'border-gray-200'
        }`}
      >
        <Pressable
          onPress={() => router.back()}
          className="mr-3 p-1"
        >
          <Text className={`text-xl ${isDark ? 'text-hub-text' : 'text-gray-900'}`}>
            {'<-'}
          </Text>
        </Pressable>
        <View className="flex-1">
          <Text
            className={`text-lg font-bold ${
              isDark ? 'text-hub-text' : 'text-gray-900'
            }`}
          >
            {agent?.name ?? 'Chat'}
          </Text>
          {agent && (
            <Text className="text-hub-text-secondary text-xs">
              {agent.type} - {agent.status}
            </Text>
          )}
        </View>
        <Pressable
          onPress={clearConversation}
          className="px-3 py-1.5 rounded-lg bg-hub-surface"
        >
          <Text className="text-hub-text text-xs">Clear</Text>
        </Pressable>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {isLoading && messages.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#533483" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingVertical: 12 }}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: true });
              }
            }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-16">
                <Text
                  className={`text-base ${
                    isDark ? 'text-hub-text-secondary' : 'text-gray-400'
                  }`}
                >
                  No messages yet
                </Text>
                <Text
                  className={`text-sm mt-1 ${
                    isDark ? 'text-hub-text-secondary' : 'text-gray-400'
                  }`}
                >
                  Send a message to start the conversation
                </Text>
              </View>
            }
          />
        )}

        {/* Loading indicator */}
        {isSending && (
          <View className="flex-row items-center px-4 py-2">
            <ActivityIndicator size="small" color="#533483" />
            <Text
              className={`ml-2 text-sm ${
                isDark ? 'text-hub-text-secondary' : 'text-gray-500'
              }`}
            >
              Agent is thinking...
            </Text>
          </View>
        )}

        <ChatInput onSend={handleSend} isSending={isSending} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}