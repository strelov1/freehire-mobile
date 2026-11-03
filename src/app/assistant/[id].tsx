import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authStore';
import { assistantApi } from '@/features/assistant/api/assistantApi';
import { Conversation } from '@/features/assistant/model/conversation';
import { AssistantAccess } from '@/features/assistant/components/AssistantAccess';
import { AssistantChat } from '@/features/assistant/components/AssistantChat';

function OwnedConversation({ id, userId, sessionEpoch }: { id: string; userId: number; sessionEpoch: number }) {
  const queryClient = useQueryClient();
  const { isOwnerCurrent } = useAuth();
  const [conversation] = useState(() => {
    const key = ['private', userId, 'assistant', 'recovering', id];
    return new Conversation(assistantApi(sessionEpoch).conversation(id), {
      initial: queryClient.getQueryData<boolean>(key) ?? false,
      changed: (value) => {
        if (isOwnerCurrent({ userId, sessionEpoch })) queryClient.setQueryData(key, value);
      },
    });
  });
  return <AssistantChat conversation={conversation} />;
}

export default function AssistantConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, sessionEpoch } = useAuth();
  return (
    <AssistantAccess>
      {user ? <OwnedConversation key={`${user.id}:${sessionEpoch}:${id}`} id={id ?? ''} userId={user.id} sessionEpoch={sessionEpoch} /> : null}
    </AssistantAccess>
  );
}
