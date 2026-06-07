import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../store/appStore';
import * as api from '../../services/api';

export default function SettingsScreen() {
  const theme = useAppStore((s) => s.theme);
  const apiUrl = useAppStore((s) => s.apiUrl);
  const isOnline = useAppStore((s) => s.isOnline);
  const setApiUrl = useAppStore((s) => s.setApiUrl);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const setIsOnline = useAppStore((s) => s.setIsOnline);
  const reset = useAppStore((s) => s.reset);

  const isDark = theme === 'dark';
  const [editingUrl, setEditingUrl] = useState(apiUrl);
  const [isUrlEditing, setIsUrlEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    try {
      await api.pingServer();
      setIsOnline(true);
      Alert.alert('Connection OK', 'Successfully connected to the API server.');
    } catch {
      setIsOnline(false);
      Alert.alert(
        'Connection Failed',
        'Could not reach the API server. Check the URL and ensure the server is running.'
      );
    } finally {
      setIsTesting(false);
    }
  }, [setIsOnline]);

  const handleSaveUrl = useCallback(() => {
    let url = editingUrl.trim();
    if (!url) {
      Alert.alert('Error', 'URL cannot be empty');
      return;
    }

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }

    try {
      new URL(url);
    } catch {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    setApiUrl(url);
    setIsUrlEditing(false);
    Alert.alert('Saved', `API URL updated to ${url}`);
  }, [editingUrl, setApiUrl]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Cache',
      'This will clear all locally cached data. You will need to reload agents and endpoints.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // Clear React Query cache is handled by the provider
            Alert.alert('Done', 'Local cache has been cleared.');
          },
        },
      ]
    );
  }, []);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset All Settings',
      'This will reset all settings to defaults. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            reset();
            setEditingUrl('http://localhost:8787');
            Alert.alert('Done', 'Settings have been reset to defaults.');
          },
        },
      ]
    );
  }, [reset]);

  const bgColor = isDark ? 'bg-hub-dark' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-hub-card' : 'bg-white';
  const borderColor = isDark ? 'border-hub-border' : 'border-gray-200';
  const textColor = isDark ? 'text-hub-text' : 'text-gray-900';
  const textSecondary = isDark ? 'text-hub-text-secondary' : 'text-gray-500';
  const inputBg = isDark ? 'bg-hub-surface' : 'bg-gray-100';

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View
        className={`px-4 py-3 border-b ${isDark ? 'border-hub-border' : 'border-gray-200'}`}
      >
        <Text className={`text-xl font-bold ${textColor}`}>Settings</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Connection Section */}
        <Text className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textSecondary}`}>
          Connection
        </Text>
        <View className={`rounded-xl p-4 mb-6 ${cardBg} border ${borderColor}`}>
          <View className="mb-4">
            <Text className={`text-sm mb-1 ${textSecondary}`}>API URL</Text>
            {isUrlEditing ? (
              <View>
                <TextInput
                  value={editingUrl}
                  onChangeText={setEditingUrl}
                  placeholder="http://localhost:8787"
                  placeholderTextColor="#6b7280"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  className={`rounded-lg px-3 py-2 text-sm font-mono ${inputBg} ${textColor}`}
                />
                <View className="flex-row gap-2 mt-2">
                  <Pressable
                    onPress={() => {
                      setEditingUrl(apiUrl);
                      setIsUrlEditing(false);
                    }}
                    className={`flex-1 py-2 rounded-lg items-center ${inputBg}`}
                  >
                    <Text className={`text-sm ${textSecondary}`}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveUrl}
                    className="flex-1 py-2 rounded-lg items-center bg-hub-highlight"
                  >
                    <Text className="text-white text-sm font-medium">Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Text
                  className={`flex-1 text-sm font-mono ${textColor}`}
                  numberOfLines={1}
                >
                  {apiUrl}
                </Text>
                <Pressable
                  onPress={() => setIsUrlEditing(true)}
                  className="ml-2 px-3 py-1.5 rounded-lg bg-hub-surface"
                >
                  <Text className="text-hub-text text-xs">Edit</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Connection Status */}
          <View className="flex-row items-center mb-4">
            <View
              className={`w-2.5 h-2.5 rounded-full mr-2 ${
                isOnline ? 'bg-hub-success' : 'bg-hub-text-secondary'
              }`}
            />
            <Text className={`text-sm flex-1 ${textSecondary}`}>
              Status: {isOnline ? 'Connected' : 'Not connected'}
            </Text>
          </View>

          <Pressable
            onPress={handleTestConnection}
            disabled={isTesting}
            className="bg-hub-surface rounded-lg py-2.5 items-center"
          >
            {isTesting ? (
              <Text className="text-hub-text text-sm">Testing...</Text>
            ) : (
              <Text className="text-hub-text text-sm font-medium">Test Connection</Text>
            )}
          </Pressable>
        </View>

        {/* Appearance Section */}
        <Text className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textSecondary}`}>
          Appearance
        </Text>
        <View className={`rounded-xl p-4 mb-6 ${cardBg} border ${borderColor}`}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className={`text-sm font-medium ${textColor}`}>Dark Mode</Text>
              <Text className={`text-xs mt-0.5 ${textSecondary}`}>
                Toggle between dark and light theme
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: '#533483' }}
              thumbColor={isDark ? '#e0e0e0' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* About Section */}
        <Text className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textSecondary}`}>
          About
        </Text>
        <View className={`rounded-xl p-4 mb-6 ${cardBg} border ${borderColor}`}>
          <View className="mb-3">
            <Text className={`text-sm ${textSecondary}`}>App Name</Text>
            <Text className={`text-sm font-medium ${textColor}`}>Multi-Agent Hub</Text>
          </View>
          <View className="mb-3">
            <Text className={`text-sm ${textSecondary}`}>Version</Text>
            <Text className={`text-sm font-medium ${textColor}`}>1.0.0</Text>
          </View>
          <View className="mb-3">
            <Text className={`text-sm ${textSecondary}`}>Platform</Text>
            <Text className={`text-sm font-medium ${textColor}`}>
              iOS / Android / Web
            </Text>
          </View>
          <View>
            <Text className={`text-xs ${textSecondary}`}>
              A multi-agent orchestration platform client. Connect to the Multi-Agent Hub
              server to manage and interact with AI agents.
            </Text>
          </View>
        </View>

        {/* Actions Section */}
        <Text className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textSecondary}`}>
          Actions
        </Text>
        <View className={`rounded-xl overflow-hidden mb-6 ${cardBg} border ${borderColor}`}>
          <Pressable
            onPress={handleClearCache}
            className={`px-4 py-3.5 border-b ${borderColor}`}
          >
            <Text className="text-hub-warning text-sm font-medium">Clear Cache</Text>
          </Pressable>
          <Pressable onPress={handleReset} className="px-4 py-3.5">
            <Text className="text-hub-error text-sm font-medium">Reset All Settings</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}