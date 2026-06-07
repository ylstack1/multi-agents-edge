import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgents } from '../../hooks/useAgents';
import { useAppStore } from '../../store/appStore';
import AgentCard from '../../components/AgentCard';
import type { Agent } from '../../services/api';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const {
    agents,
    isLoading,
    isError,
    error,
    refetch,
    createAgent,
    isCreating,
    deleteAgent,
  } = useAgents();
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('assistant');
  const [refreshing, setRefreshing] = useState(false);

  const activeAgents = agents.filter((a) => a.status === 'active').length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const openAgentWorkspace = useCallback((agent: Agent) => {
    router.push(`/workspace/${agent.id}`);
  }, []);

  const handleDeleteAgent = useCallback(
    (agent: Agent) => {
      Alert.alert(
        'Delete Agent',
        `Are you sure you want to delete "${agent.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteAgent(agent.id),
          },
        ]
      );
    },
    [deleteAgent]
  );

  const handleCreateAgent = useCallback(async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Agent name is required');
      return;
    }

    try {
      await createAgent({ name: newName.trim(), type: newType });
      setShowCreateModal(false);
      setNewName('');
      setNewType('assistant');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String(err.message)
          : 'Failed to create agent';
      Alert.alert('Error', msg);
    }
  }, [newName, newType, createAgent]);

  const agentTypes = ['assistant', 'chat', 'tool', 'custom'];

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-hub-dark' : 'bg-gray-50'}`}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
      <View
        className={`px-4 pt-2 pb-4 ${isDark ? '' : ''}`}
        style={{ paddingTop: insets.top + 8 }}
      >
        <Text
          className={`text-2xl font-bold ${isDark ? 'text-hub-text' : 'text-gray-900'}`}
        >
          Multi-Agent Hub
        </Text>

        {/* Quick Stats */}
        <View className="flex-row gap-3 mt-3">
          <View
            className={`flex-1 rounded-xl p-3 ${
              isDark ? 'bg-hub-card border border-hub-border' : 'bg-white shadow-sm'
            }`}
          >
            <Text
              className={`text-2xl font-bold ${isDark ? 'text-hub-success' : 'text-green-600'}`}
            >
              {activeAgents}
            </Text>
            <Text
              className={`text-xs mt-1 ${
                isDark ? 'text-hub-text-secondary' : 'text-gray-500'
              }`}
            >
              Active Agents
            </Text>
          </View>
          <View
            className={`flex-1 rounded-xl p-3 ${
              isDark ? 'bg-hub-card border border-hub-border' : 'bg-white shadow-sm'
            }`}
          >
            <Text
              className={`text-2xl font-bold ${isDark ? 'text-hub-highlight' : 'text-purple-600'}`}
            >
              {agents.length}
            </Text>
            <Text
              className={`text-xs mt-1 ${
                isDark ? 'text-hub-text-secondary' : 'text-gray-500'
              }`}
            >
              Total Agents
            </Text>
          </View>
        </View>
      </View>

      {/* Agent List */}
      {isLoading && agents.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#533483" />
          <Text className="text-hub-text-secondary mt-3">Loading agents...</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-hub-error text-base mb-2">Failed to load agents</Text>
          <Text className="text-hub-text-secondary text-sm text-center mb-4">
            {error && typeof error === 'object' && 'message' in error
              ? String(error.message)
              : 'Unknown error'}
          </Text>
          <Pressable
            onPress={() => refetch()}
            className="bg-hub-highlight px-6 py-2 rounded-lg"
          >
            <Text className="text-white font-medium">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AgentCard
              agent={item}
              onPress={openAgentWorkspace}
              onLongPress={handleDeleteAgent}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#533483"
              colors={['#533483']}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-hub-text-secondary text-base mb-2">No agents found</Text>
              <Text className="text-hub-text-secondary text-sm text-center px-8">
                Tap the + button below to create your first agent.
              </Text>
            </View>
          }
        />
      )}

      {/* FAB - Create Agent */}
      <Pressable
        onPress={() => setShowCreateModal(true)}
        className="absolute bottom-6 right-6 w-14 h-14 bg-hub-highlight rounded-full items-center justify-center shadow-lg active:opacity-80"
        style={{
          shadowColor: '#533483',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
          bottom: 24,
        }}
      >
        <Text className="text-white text-2xl font-bold leading-none">+</Text>
      </Pressable>

      {/* Create Agent Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className={`rounded-t-3xl p-6 ${
              isDark ? 'bg-hub-card' : 'bg-white'
            }`}
          >
            <Text
              className={`text-xl font-bold mb-6 ${
                isDark ? 'text-hub-text' : 'text-gray-900'
              }`}
            >
              Create New Agent
            </Text>

            {/* Name Input */}
            <Text
              className={`text-sm mb-2 ${
                isDark ? 'text-hub-text-secondary' : 'text-gray-600'
              }`}
            >
              Agent Name
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter agent name..."
              placeholderTextColor="#6b7280"
              className={`rounded-xl px-4 py-3 mb-4 ${
                isDark
                  ? 'bg-hub-surface text-hub-text border border-hub-border'
                  : 'bg-gray-100 text-gray-900'
              }`}
              autoFocus
              maxLength={64}
            />

            {/* Type Selector */}
            <Text
              className={`text-sm mb-2 ${
                isDark ? 'text-hub-text-secondary' : 'text-gray-600'
              }`}
            >
              Agent Type
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {agentTypes.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setNewType(type)}
                  className={`px-4 py-2 rounded-lg ${
                    newType === type
                      ? 'bg-hub-highlight'
                      : isDark
                        ? 'bg-hub-surface border border-hub-border'
                        : 'bg-gray-100'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      newType === type
                        ? 'text-white'
                        : isDark
                          ? 'text-hub-text-secondary'
                          : 'text-gray-600'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Buttons */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowCreateModal(false)}
                className={`flex-1 py-3 rounded-xl items-center ${
                  isDark ? 'bg-hub-surface' : 'bg-gray-200'
                }`}
              >
                <Text
                  className={`font-medium ${
                    isDark ? 'text-hub-text' : 'text-gray-700'
                  }`}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCreateAgent}
                disabled={isCreating || !newName.trim()}
                className={`flex-1 py-3 rounded-xl items-center ${
                  isCreating || !newName.trim()
                    ? 'bg-hub-highlight/50'
                    : 'bg-hub-highlight'
                }`}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-medium">Create</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}