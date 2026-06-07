import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { Agent } from '../services/api';

interface AgentCardProps {
  agent: Agent;
  onPress: (agent: Agent) => void;
  onLongPress?: (agent: Agent) => void;
}

const statusColors: Record<string, string> = {
  active: 'bg-hub-success',
  inactive: 'bg-hub-text-secondary',
  error: 'bg-hub-error',
};

const typeIcons: Record<string, string> = {
  assistant: 'A',
  chat: 'C',
  tool: 'T',
  custom: 'M',
};

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}

export default function AgentCard({ agent, onPress, onLongPress }: AgentCardProps) {
  const statusColor = statusColors[agent.status] ?? statusColors.inactive;
  const typeIcon = typeIcons[agent.type] ?? '?';
  const isActive = agent.status === 'active';

  return (
    <Pressable
      onPress={() => onPress(agent)}
      onLongPress={() => onLongPress?.(agent)}
      className="active:opacity-80"
    >
      <View className="bg-hub-card rounded-xl p-4 mb-3 border border-hub-border flex-row items-center">
        {/* Type Badge */}
        <View className="w-12 h-12 rounded-full bg-hub-accent items-center justify-center mr-3">
          <Text className="text-white text-lg font-bold">{typeIcon}</Text>
        </View>

        {/* Agent Info */}
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Text className="text-hub-text text-base font-semibold flex-1" numberOfLines={1}>
              {agent.name}
            </Text>
            {/* Status Indicator */}
            <View className="flex-row items-center ml-2">
              <View className={`w-2.5 h-2.5 rounded-full ${statusColor} ${isActive ? '' : 'opacity-50'}`} />
              <Text className="text-hub-text-secondary text-xs ml-1.5 capitalize">
                {agent.status}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            <Text className="text-hub-text-secondary text-xs mr-3">
              Type: {agent.type}
            </Text>
            <Text className="text-hub-text-secondary text-xs">
              Modified: {formatDate(agent.lastModified)}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <Text className="text-hub-text-secondary text-lg ml-2">{'>'}</Text>
      </View>
    </Pressable>
  );
}