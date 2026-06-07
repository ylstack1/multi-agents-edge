import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { useAppStore } from '../../store/appStore';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconMap: Record<string, string> = {
    dashboard: '[ ]',
    chat: '<->',
    mcp: '{*}',
    settings: '(@)',
  };

  return (
    <View className="items-center justify-center">
      <Text
        className={`text-lg font-bold ${
          focused ? 'text-hub-highlight' : 'text-hub-text-secondary'
        }`}
      >
        {iconMap[name] ?? name}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
          borderTopColor: isDark ? '#2a2a3e' : '#e5e5e5',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: '#533483',
        tabBarInactiveTintColor: '#a0a0b0',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon name="dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => <TabIcon name="chat" focused={focused} />,
          href: '/chat',
        }}
      />
      <Tabs.Screen
        name="mcp"
        options={{
          title: 'MCP',
          tabBarIcon: ({ focused }) => <TabIcon name="mcp" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}