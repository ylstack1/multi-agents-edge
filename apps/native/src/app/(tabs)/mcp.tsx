import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/appStore';
import MCPEndpointCard from '../../components/MCPEndpointCard';
import * as api from '../../services/api';
import type { MCPEndpoint, MCPTool } from '../../services/api';

export default function MCPScreen() {
  const theme = useAppStore((s) => s.theme);
  const endpoints = useAppStore((s) => s.mcpEndpoints);
  const addEndpoint = useAppStore((s) => s.addMcpEndpoint);
  const removeEndpoint = useAppStore((s) => s.removeMcpEndpoint);
  const updateEndpoint = useAppStore((s) => s.updateMcpEndpoint);
  const isDark = theme === 'dark';

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Discovered tools modal
  const [toolsModalVisible, setToolsModalVisible] = useState(false);
  const [discoveredTools, setDiscoveredTools] = useState<MCPTool[]>([]);
  const [toolsEndpointName, setToolsEndpointName] = useState('');

  const loadEndpoints = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchMCPEndpoints();
      useAppStore.getState().setMcpEndpoints(data);
    } catch (err: unknown) {
      // Silently fail - endpoints may not exist yet
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load endpoints on mount
  React.useEffect(() => {
    loadEndpoints();
  }, [loadEndpoints]);

  const handleAddEndpoint = useCallback(async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Endpoint name is required');
      return;
    }
    if (!newUrl.trim()) {
      Alert.alert('Error', 'Endpoint URL is required');
      return;
    }

    // Validate URL
    try {
      new URL(newUrl.trim());
    } catch {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    setIsAdding(true);
    try {
      const endpoint = await api.addMCPEndpoint({
        name: newName.trim(),
        url: newUrl.trim(),
      });
      addEndpoint(endpoint);
      setShowAddForm(false);
      setNewName('');
      setNewUrl('');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String(err.message)
          : 'Failed to add endpoint';
      Alert.alert('Error', msg);
    } finally {
      setIsAdding(false);
    }
  }, [newName, newUrl, addEndpoint]);

  const handlePing = useCallback(
    async (endpoint: MCPEndpoint) => {
      try {
        await api.pingMCPEndpoint(endpoint.id);
        updateEndpoint(endpoint.id, { status: 'online' });
        Alert.alert('Success', `${endpoint.name} is online`);
      } catch {
        updateEndpoint(endpoint.id, { status: 'offline' });
        Alert.alert('Error', `${endpoint.name} is offline or unreachable`);
      }
    },
    [updateEndpoint]
  );

  const handleDiscover = useCallback(
    async (endpoint: MCPEndpoint) => {
      try {
        const result = await api.discoverMCPTools(endpoint.id);
        const tools = result.tools ?? [];
        updateEndpoint(endpoint.id, { tools, status: 'online' });
        setDiscoveredTools(tools);
        setToolsEndpointName(endpoint.name);
        setToolsModalVisible(true);
      } catch {
        updateEndpoint(endpoint.id, { status: 'offline' });
        Alert.alert('Error', `Failed to discover tools from ${endpoint.name}`);
      }
    },
    [updateEndpoint]
  );

  const handleDelete = useCallback(
    (endpoint: MCPEndpoint) => {
      Alert.alert(
        'Delete Endpoint',
        `Remove "${endpoint.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deleteMCPEndpoint(endpoint.id);
                removeEndpoint(endpoint.id);
              } catch {
                Alert.alert('Error', 'Failed to delete endpoint');
              }
            },
          },
        ]
      );
    },
    [removeEndpoint]
  );

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-hub-dark' : 'bg-gray-50'}`}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
      <View
        className={`px-4 py-3 border-b flex-row items-center justify-between ${
          isDark ? 'border-hub-border' : 'border-gray-200'
        }`}
      >
        <Text
          className={`text-xl font-bold ${isDark ? 'text-hub-text' : 'text-gray-900'}`}
        >
          MCP Configuration
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={loadEndpoints}
            className="px-3 py-1.5 rounded-lg bg-hub-surface"
          >
            <Text className="text-hub-text text-xs">Refresh</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowAddForm(true)}
            className="px-3 py-1.5 rounded-lg bg-hub-highlight"
          >
            <Text className="text-white text-xs font-medium">+ Add</Text>
          </Pressable>
        </View>
      </View>

      {/* Endpoint List */}
      {isLoading && endpoints.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#533483" />
          <Text className="text-hub-text-secondary mt-3">Loading endpoints...</Text>
        </View>
      ) : (
        <FlatList
          data={endpoints}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MCPEndpointCard
              endpoint={item}
              onPing={handlePing}
              onDiscover={handleDiscover}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-hub-text-secondary text-base mb-2">
                No MCP endpoints configured
              </Text>
              <Text className="text-hub-text-secondary text-sm text-center px-8">
                Tap "+ Add" to add an MCP endpoint, then use Ping to check connectivity
                and Discover to list available tools.
              </Text>
            </View>
          }
        />
      )}

      {/* Add Endpoint Modal */}
      <Modal
        visible={showAddForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddForm(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className={`rounded-t-3xl p-6 ${isDark ? 'bg-hub-card' : 'bg-white'}`}
          >
            <Text
              className={`text-xl font-bold mb-6 ${
                isDark ? 'text-hub-text' : 'text-gray-900'
              }`}
            >
              Add MCP Endpoint
            </Text>

            <Text
              className={`text-sm mb-2 ${
                isDark ? 'text-hub-text-secondary' : 'text-gray-600'
              }`}
            >
              Endpoint Name
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g., Local MCP Server"
              placeholderTextColor="#6b7280"
              className={`rounded-xl px-4 py-3 mb-4 ${
                isDark
                  ? 'bg-hub-surface text-hub-text border border-hub-border'
                  : 'bg-gray-100 text-gray-900'
              }`}
              autoFocus
              maxLength={64}
            />

            <Text
              className={`text-sm mb-2 ${
                isDark ? 'text-hub-text-secondary' : 'text-gray-600'
              }`}
            >
              Endpoint URL
            </Text>
            <TextInput
              value={newUrl}
              onChangeText={setNewUrl}
              placeholder="e.g., http://localhost:3001/mcp"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              className={`rounded-xl px-4 py-3 mb-6 ${
                isDark
                  ? 'bg-hub-surface text-hub-text border border-hub-border font-mono'
                  : 'bg-gray-100 text-gray-900 font-mono'
              }`}
              maxLength={512}
            />

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowAddForm(false)}
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
                onPress={handleAddEndpoint}
                disabled={isAdding || !newName.trim() || !newUrl.trim()}
                className={`flex-1 py-3 rounded-xl items-center ${
                  isAdding || !newName.trim() || !newUrl.trim()
                    ? 'bg-hub-highlight/50'
                    : 'bg-hub-highlight'
                }`}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-medium">Add</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Discovered Tools Modal */}
      <Modal
        visible={toolsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setToolsModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className={`rounded-t-3xl p-6 max-h-[70%] ${
              isDark ? 'bg-hub-card' : 'bg-white'
            }`}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text
                className={`text-lg font-bold ${
                  isDark ? 'text-hub-text' : 'text-gray-900'
                }`}
              >
                Tools from {toolsEndpointName}
              </Text>
              <Pressable onPress={() => setToolsModalVisible(false)}>
                <Text className="text-hub-highlight font-medium">Close</Text>
              </Pressable>
            </View>

            <FlatList
              data={discoveredTools}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <View
                  className={`mb-3 p-3 rounded-xl ${
                    isDark ? 'bg-hub-surface border border-hub-border' : 'bg-gray-100'
                  }`}
                >
                  <Text
                    className={`text-base font-semibold mb-1 ${
                      isDark ? 'text-hub-text' : 'text-gray-900'
                    }`}
                  >
                    {item.name}
                  </Text>
                  <Text className="text-hub-text-secondary text-sm">
                    {item.description || 'No description'}
                  </Text>
                  {item.inputSchema && Object.keys(item.inputSchema).length > 0 && (
                    <Text className="text-hub-text-secondary text-xs mt-2 font-mono">
                      {JSON.stringify(item.inputSchema, null, 2).slice(0, 200)}
                    </Text>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <Text className="text-hub-text-secondary text-center py-8">
                  No tools discovered
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}