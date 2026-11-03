import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, useColorScheme } from 'react-native';
import { getColors } from '@/constants/freehire';
import { useAuth } from '@/lib/authStore';
import { SessionUnavailable } from '@/components/SessionUnavailable';
import { isProLive } from '@/features/billing/model/planView';
import { usePlan } from '@/lib/usePlan';

/**
 * The assistant is a Pro feature. The server enforces it (it answers 402), so this gate is the
 * courtesy in front of that: it reads the same server-side plan the plan screen does, never the
 * purchases SDK, so a web subscriber and an in-app subscriber are both let through.
 */
function ProGate({ children }: { children: ReactNode }) {
  const c = getColors(useColorScheme());
  const { data: plan, isError, isPending, refetch } = usePlan();
  if (plan) {
    if (isProLive(plan)) return children;
  } else if (isPending) {
    return <ActivityIndicator style={{ flex: 1 }} color={c.brandStrong} />;
  } else if (isError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <Text style={{ color: c.mutedForeground, fontSize: 16, textAlign: 'center' }}>We couldn’t check your plan.</Text>
        <Pressable accessibilityRole="button" onPress={() => void refetch()} style={{ padding: 16, borderRadius: 12, backgroundColor: c.brand }}>
          <Text style={{ color: c.brandForeground, textAlign: 'center', fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 20 }}>
      <Text style={{ color: c.foreground, fontSize: 26, fontWeight: '700' }}>Assistant is part of freehire Pro</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 16, lineHeight: 24 }}>
        Find jobs, talk through your experience and get ready for interviews. Upgrade to Pro to chat with your assistant.
      </Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/account/plan')} style={{ padding: 16, borderRadius: 12, backgroundColor: c.brand }}>
        <Text style={{ color: c.brandForeground, textAlign: 'center', fontWeight: '700' }}>See Pro</Text>
      </Pressable>
    </View>
  );
}

export function AssistantAccess({ children }: { children: ReactNode }) {
  const c = getColors(useColorScheme());
  const { user, state, retryBootstrap } = useAuth();
  if (state.status === 'unavailable') return <SessionUnavailable onRetry={retryBootstrap} />;
  if (['bootstrapping', 'authenticating', 'signingOut'].includes(state.status)) {
    return <ActivityIndicator style={{ flex: 1 }} color={c.brandStrong} />;
  }
  if (user) return <ProGate>{children}</ProGate>;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 20 }}>
      <Text style={{ color: c.foreground, fontSize: 26, fontWeight: '700' }}>Your job search assistant</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 16, lineHeight: 24 }}>
        Find opportunities, explore your experience and plan your next step. Your conversations stay with your FreeHire account.
      </Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={{ padding: 16, borderRadius: 12, backgroundColor: c.brand }}>
        <Text style={{ color: c.brandForeground, textAlign: 'center', fontWeight: '700' }}>Sign in to use Assistant</Text>
      </Pressable>
    </View>
  );
}
