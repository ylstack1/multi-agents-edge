import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAppStore } from '../../store/appStore';
import { useAgent, useAgents } from '../../hooks/useAgents';

type WorkspaceTab = 'soul' | 'identity' | 'user' | 'memory' | 'tools';

const TAB_LABELS: Record<WorkspaceTab, string> = {
  soul: 'Soul',
  identity: 'Identity',
  user: 'User',
  memory: 'Memory',
  tools: 'Tools',
};

const TAB_ICONS: Record<WorkspaceTab, string> = {
  soul: '[S]',
  identity: '[I]',
  user: '[U]',
  memory: '[M]',
  tools: '[T]',
};

export default function WorkspaceScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';

  const { agent, isLoading, refetch } = useAgent(agentId ?? '');
  const { updateWorkspace, isUpdatingWorkspace, resetMemory, isResettingMemory } = useAgents();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('soul');
  const [editedContent, setEditedContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync content when agent data loads or tab changes
  React.useEffect(() => {
    if (agent?.workspace) {
      const content = agent.workspace[activeTab] ?? '';
      setEditedContent(content);
      setHasChanges(false);
    }
  }, [agent, activeTab]);

  const handleSave = useCallback(async () => {
    if (!agentId || !agent) return;

    try {
      await updateWorkspace({
        agentId,
        workspace: { [activeTab]: editedContent },
      });
      setHasChanges(false);
      Alert.alert('Saved', `${TAB_LABELS[activeTab]} file updated successfully.`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String(err.message)
          : 'Failed to save';
      Alert.alert('Error', msg);
    }
  }, [agentId, agent, activeTab, editedContent, updateWorkspace]);

  const handleResetMemory = useCallback(() => {
    if (!agentId) return;

    Alert.alert(
      'Reset Memory',
      'This will clear all memory for this agent. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetMemory(agentId);
              setEditedContent('');
              setHasChanges(true);
              Alert.alert('Done', 'Agent memory has been reset.');
            } catch {
              Alert.alert('Error', 'Failed to reset memory');
            }
          },
        },
      ]
    );
  }, [agentId, resetMemory]);

  const handleTextChange = useCallback((text: string) => {
    setEditedContent(text);
    setHasChanges(true);
  }, []);

  const canResetMemory = activeTab === 'memory' && (editedContent?.length ?? 0) > 0;
  const isTabActive = (tab: WorkspaceTab) => activeTab === tab;

  const tabs: WorkspaceTab[] = ['soul', 'identity', 'user', 'memory', 'tools'];

  if (isLoading || !agent) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? 'bg-hub-dark' : 'bg-gray-50'}`}
        edges={['top', 'left', 'right']}
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#533483" />
          <Text className="text-hub-text-secondary mt-3">
            {isLoading ? 'Loading workspace...' : 'Agent not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const charCount = editedContent.length;

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
        <Pressable onPress={() => router.back()} className="mr-3 p-1">
          <Text className={`text-xl ${isDark ? 'text-hub-text' : 'text-gray-900'}`}>
            {'<-'}
          </Text>
        </Pressable>
        <View className="flex-1">
          <Text
            className={`text-lg font-bold ${
              isDark ? 'text-hub-text' : 'text-gray-900'
            }`}
            numberOfLines={1}
          >
            {agent.name}
          </Text>
          <Text className={`text-xs ${isDark ? 'text-hub-text-secondary' : 'text-gray-500'}`}>
            {agent.type} - Workspace Editor
          </Text>
        </View>
        <Pressable
          onPress={handleSave}
          disabled={!hasChanges || isUpdatingWorkspace}
          className={`px-4 py-2 rounded-lg ${
            hasChanges && !isUpdatingWorkspace
              ? 'bg-hub-highlight'
              : isDark
                ? 'bg-hub-surface'
                : 'bg-gray-200'
          }`}
        >
          {isUpdatingWorkspace ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              className={`text-sm font-medium ${
                hasChanges ? 'text-white' : isDark ? 'text-hub-text-secondary' : 'text-gray-500'
              }`}
            >
              Save
            </Text>
          )}
        </Pressable>
      </View>

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className={`border-b ${isDark ? 'border-hub-border' : 'border-gray-200'}`}
      >
        <View className="flex-row px-2">
          {tabs.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`px-4 py-3 border-b-2 ${
                isTabActive(tab)
                  ? isDark
                    ? 'border-hub-highlight'
                    : 'border-purple-600'
                  : 'border-transparent'
              }`}
            >
              <Text
                className={`text-sm ${
                  isTabActive(tab)
                    ? isDark
                      ? 'text-hub-highlight font-semibold'
                      : 'text-purple-600 font-semibold'
                    : isDark
                      ? 'text-hub-text-secondary'
                      : 'text-gray-500'
                }`}
              >
                {TAB_ICONS[tab]} {TAB_LABELS[tab]}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Editor */}
      <View className="flex-1 px-4 pt-3">
        {/* File Info Bar */}
        <View className="flex-row items-center justify-between mb-2">
          <Text
            className={`text-xs font-mono ${
              isDark ? 'text-hub-text-secondary' : 'text-gray-500'
            }`}
          >
            {TAB_LABELS[activeTab].toLowerCase()}.md
          </Text>
          <View className="flex-row items-center gap-3">
            <Text
              className={`text-xs ${
                isDark ? 'text-hub-text-secondary' : 'text-gray-500'
              }`}
            >
              {charCount} chars
            </Text>
            {canResetMemory && (
              <Pressable
                onPress={handleResetMemory}
                disabled={isResettingMemory}
                className="px-2 py-1 rounded bg-hub-error/20"
              >
                <Text className="text-hub-error text-xs">
                  {isResettingMemory ? 'Resetting...' : 'Reset'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Text Editor */}
        <TextInput
          value={editedContent}
          onChangeText={handleTextChange}
          multiline
          textAlignVertical="top"
          placeholder={`Enter ${TAB_LABELS[activeTab]} content in markdown...`}
          placeholderTextColor="#6b7280"
          className={`flex-1 rounded-xl p-4 text-sm leading-6 font-mono ${
            isDark
              ? 'bg-hub-card text-hub-text border border-hub-border'
              : 'bg-white text-gray-900 border border-gray-200'
          }`}
          style={{
            lineHeight: 24,
            fontSize: 14,
          }}
          scrollEnabled
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </SafeAreaView>
  );
}