import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useSegments } from 'expo-router';
import { useAppStore } from '../../store/appStore';
import MessageBubble from '../../components/MessageBubble';
import ChatInput from '../../components/ChatInput';
import { useChat } from '../../hooks/useChat';
import type { Message } from '../../services/api';

export default function ChatScreen() {
  const theme = useAppStore((s) => s.theme);
  const agents = useAppStore((s) => s.agents);
  const isDark = theme === 'dark';

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-hub-dark' : 'bg-gray-50'}`}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
      <View
        className={`px-4 py-3 border-b ${
          isDark ? 'border-hub-border' : 'border-gray-200'
        }`}
      >
        <Text
          className={`text-xl font-bold ${isDark ? 'text-hub-text' : 'text-gray-900'}`}
        >
          Chat
        </Text>
      </View>

      {/* Agent Selector */}
      <Pressable
        onPress={() => setShowAgentPicker(!showAgentPicker)}
        className={`mx-4 mt-3 mb-2 px-4 py-3 rounded-xl flex-row items-center ${
          isDark ? 'bg-hub-card border border-hub-border' : 'bg-white border border-gray-200'
        }`}
      >
        <Text
          className={`flex-1 text-base ${
            selectedAgent
              ? isDark
                ? 'text-hub-text'
                : 'text-gray-900'
              : 'text-hub-text-secondary'
          }`}
        >
          {selectedAgent ? selectedAgent.name : 'Select an agent to chat with...'}
        </Text>
        <Text className={`text-lg ${isDark ? 'text-hub-text-secondary' : 'text-gray-400'}`}>
          {showAgentPicker ? '▲' : '▼'}
        </Text>
      </Pressable>

      {/* Agent Picker Dropdown */}
      {showAgentPicker && (
        <View
          className={`mx-4 mb-2 rounded-xl border overflow-hidden ${
            isDark ? 'bg-hub-card border-hub-border' : 'bg-white border-gray-200'
          }`}
          style={{ maxHeight: 200 }}
        >
          <FlatList
            data={agents}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSelectedAgentId(item.id);
                  setShowAgentPicker(false);
                }}
                className={`px-4 py-3 flex-row items-center ${
                  isDark
                    ? item.id === selectedAgentId
                      ? 'bg-hub-highlight/20'
                      : ''
                    : item.id === selectedAgentId
                      ? 'bg-purple-50'
                      : ''
                }`}
              >
                <View
                  className={`w-2.5 h-2.5 rounded-full mr-3 ${
                    item.status === 'active' ? 'bg-hub-success' : 'bg-hub-text-secondary'
                  }`}
                />
                <Text
                  className={`flex-1 text-sm ${
                    isDark ? 'text-hub-text' : 'text-gray-900'
                  }`}
                >
                  {item.name}
                </Text>
                {item.id === selectedAgentId && (
                  <Text className="text-hub-highlight text-xs ml-2">Active</Text>
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View className="py-8 items-center">
                <Text className={isDark ? 'text-hub-text-secondary' : 'text-gray-500'}>
                  No agents available. Create one on the Dashboard.
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Chat Messages */}
      {selectedAgentId ? (
        <ChatView agentId={selectedAgentId} />
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <Text
            className={`text-lg text-center mb-2 ${
              isDark ? 'text-hub-text-secondary' : 'text-gray-400'
            }`}
          >
            Select an agent above to start chatting
          </Text>
          <Text
            className={`text-sm text-center ${
              isDark ? 'text-hub-text-secondary' : 'text-gray-400'
            }`}
          >
            Or create a new agent from the Dashboard tab
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function ChatView({ agentId }: { agentId: string }) {
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';
  const flatListRef = useRef<FlatList<Message>>(null);
  const { messages, isLoading, isSending, sendMessage, clearConversation } = useChat(agentId);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    if (messages.length > 0 && !hasScrolled) {
      setHasScrolled(true);
    }
  }, [messages.length, hasScrolled]);

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
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View className="flex-1">
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
            contentContainerStyle={{
              paddingVertical: 12,
            }}
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

        {/* Loading indicator for response */}
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
      </View>
    </KeyboardAvoidingView>
  );
}