import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { MCPEndpoint } from '../services/api';

interface MCPEndpointCardProps {
  endpoint: MCPEndpoint;
  onPing: (endpoint: MCPEndpoint) => void;
  onDiscover: (endpoint: MCPEndpoint) => void;
  onDelete: (endpoint: MCPEndpoint) => void;
}

const statusColors: Record<string, string> = {
  online: 'bg-hub-success',
  offline: 'bg-hub-error',
  unknown: 'bg-hub-text-secondary',
};

export default function MCPEndpointCard({
  endpoint,
  onPing,
  onDiscover,
  onDelete,
}: MCPEndpointCardProps) {
  const statusColor = statusColors[endpoint.status] ?? statusColors.unknown;
  const toolCount = endpoint.tools?.length ?? 0;

  return (
    <View className="bg-hub-card rounded-xl p-4 mb-3 border border-hub-border">
      {/* Header */}
      <View className="flex-row items-center mb-2">
        <View className={`w-3 h-3 rounded-full ${statusColor} mr-2`} />
        <Text className="text-hub-text text-base font-semibold flex-1" numberOfLines={1}>
          {endpoint.name}
        </Text>
        <Text className="text-hub-text-secondary text-xs capitalize">{endpoint.status}</Text>
      </View>

      {/* URL */}
      <Text className="text-hub-text-secondary text-xs mb-3 font-mono" numberOfLines={1}>
        {endpoint.url}
      </Text>

      {/* Tools Count */}
      {toolCount > 0 && (
        <Text className="text-hub-text-secondary text-xs mb-3">
          {toolCount} tool{toolCount !== 1 ? 's' : ''} discovered
        </Text>
      )}

      {/* Actions */}
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => onPing(endpoint)}
          className="flex-1 bg-hub-surface rounded-lg py-2 items-center"
        >
          <Text className="text-hub-text text-xs font-medium">Ping</Text>
        </Pressable>
        <Pressable
          onPress={() => onDiscover(endpoint)}
          className="flex-1 bg-hub-surface rounded-lg py-2 items-center"
        >
          <Text className="text-hub-text text-xs font-medium">Discover</Text>
        </Pressable>
        <Pressable
          onPress={() => onDelete(endpoint)}
          className="bg-hub-surface rounded-lg py-2 px-3 items-center"
        >
          <Text className="text-hub-error text-xs font-medium">Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}