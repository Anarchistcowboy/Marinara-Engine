// ──────────────────────────────────────────────
// React Query: Chat hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { Chat, Message } from "@rpg-engine/shared";

export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  detail: (id: string) => [...chatKeys.all, "detail", id] as const,
  messages: (chatId: string) => [...chatKeys.all, "messages", chatId] as const,
  group: (groupId: string) => [...chatKeys.all, "group", groupId] as const,
};

export function useChats() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: () => api.get<Chat[]>("/chats"),
  });
}

export function useChat(id: string | null) {
  return useQuery({
    queryKey: chatKeys.detail(id ?? ""),
    queryFn: () => api.get<Chat>(`/chats/${id}`),
    enabled: !!id,
  });
}

export function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(chatId ?? ""),
    queryFn: () => api.get<Message[]>(`/chats/${chatId}/messages`),
    enabled: !!chatId,
  });
}

export function useChatGroup(groupId: string | null) {
  return useQuery({
    queryKey: chatKeys.group(groupId ?? ""),
    queryFn: () => api.get<Chat[]>(`/chats/group/${groupId}`),
    enabled: !!groupId,
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; mode: string; characterIds?: string[]; groupId?: string | null }) =>
      api.post<Chat>("/chats", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/chats/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useUpdateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; mode?: string; connectionId?: string | null; promptPresetId?: string | null; characterIds?: string[] }) =>
      api.patch<Chat>(`/chats/${id}`, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

export function useUpdateChatMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...metadata }: { id: string; [key: string]: unknown }) =>
      api.patch<Chat>(`/chats/${id}/metadata`, metadata),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(vars.id) });
    },
  });
}

export function useDeleteMessage(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      api.delete(`/chats/${chatId}/messages/${messageId}`),
    onSuccess: () => {
      if (chatId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      }
    },
  });
}

/** Export a chat as JSONL */
export function useExportChat() {
  return useMutation({
    mutationFn: async (chatId: string) => {
      const res = await fetch(`/api/chats/${chatId}/export`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match?.[1] ? decodeURIComponent(match[1]) : `chat-${chatId}.jsonl`;
      // Download via blob
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

/** Create a branch (copy) of an existing chat */
export function useBranchChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, upToMessageId }: { chatId: string; upToMessageId?: string }) =>
      api.post<Chat>(`/chats/${chatId}/branch`, { upToMessageId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

/** Clear all user data */
export function useClearAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>("/admin/clear-all", { confirm: true }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
