export type AgentRole = 'LEAD' | 'SUB_AGENT';

export type IngressSource = 'TELEGRAM' | 'WEB_UI';

export type AgentStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';

export interface AgentManifest {
  type: AgentRole;
  status: AgentStatus;
  mcpEndpointIds: string[];
}