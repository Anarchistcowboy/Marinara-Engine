// ──────────────────────────────────────────────
// Hooks: Agent Configs (React Query)
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";

const agentKeys = {
  all: ["agents"] as const,
  detail: (id: string) => ["agents", id] as const,
};

export interface AgentConfigRow {
  id: string;
  type: string;
  name: string;
  description: string;
  phase: string;
  enabled: string;
  connectionId: string | null;
  promptTemplate: string;
  settings: string;
  createdAt: string;
  updatedAt: string;
}

export function useAgentConfigs() {
  return useQuery({
    queryKey: agentKeys.all,
    queryFn: () => api.get<AgentConfigRow[]>("/agents"),
  });
}

export function useAgentConfig(id: string | null) {
  return useQuery({
    queryKey: agentKeys.detail(id ?? ""),
    queryFn: () => api.get<AgentConfigRow>(`/agents/${id}`),
    enabled: !!id,
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch(`/agents/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/agents", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useToggleAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentType: string) => api.put(`/agents/toggle/${agentType}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}
