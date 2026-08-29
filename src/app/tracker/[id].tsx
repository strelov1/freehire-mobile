import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/AppSymbol';
import { ApplicationStagePicker } from '@/components/ApplicationStagePicker';
import { CompanyLogo } from '@/components/CompanyLogo';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { TrackerActions } from '@/components/tracker/TrackerActions';
import { TrackerNotesCard } from '@/components/tracker/TrackerNotesCard';
import { TrackerSignalsCard } from '@/components/tracker/TrackerSignalsCard';
import { TrackerStageCard } from '@/components/tracker/TrackerStageCard';
import { getColors, Radius, Space } from '@/constants/freehire';
import { formatDate, timeAgo } from '@/lib/format';
import {
  canMarkApplied,
  formatSilence,
  groupOf,
  isPrunedJob,
  stageLabel,
  type TrackerStage,
} from '@/lib/tracker';
import type { TrackedJob } from '@/lib/types';
import { useTrackedJobs, useTrackerMutations } from '@/lib/useTracker';

function BackButton({ color }: { color: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as any))}
      style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}>
      <AppSymbol name="chevron.left" size={22} weight="semibold" tintColor={color} />
    </Pressable>
  );
}

export default function TrackerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = getColors(useColorScheme());

  // Resolve board query - never send an orphan ID to GET /me/tracking/:slug
  const { data, isLoading } = useTrackedJobs('board');
  const {
    markApplied,
    updateStage,
    updateNotes,
    moveToSaved,
    removeFromTracker,
    isMarkingApplied,
    isUpdatingStage,
    isUpdatingNotes,
    isMovingToSaved,
    isRemoving,
  } = useTrackerMutations();

  const application: TrackedJob | undefined = useMemo(() => {
    if (!id || !data?.data) return undefined;
    return data.data.find((j) => j.id === id || j.job?.public_slug === id);
  }, [id, data]);

  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string | null;
    confirmVariant?: 'primary' | 'danger' | 'default';
    onConfirm: () => void;
  } | null>(null);

  const showError = useCallback((title: string, err: unknown) => {
    const message =
      err instanceof Error
        ? err.message
        : (err as any)?.message ?? 'An unexpected error occurred';
    setConfirmModal({
      visible: true,
      title,
      message,
      confirmText: 'OK',
      cancelText: null,
      confirmVariant: 'default',
      onConfirm: () => setConfirmModal(null),
    });
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.fill, styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.brand} />
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView edges={['top']} style={[styles.fill, styles.center, { backgroundColor: c.background }]}>
        <AppSymbol name="exclamationmark.circle" size={36} tintColor={c.mutedForeground} />
        <Text style={[styles.stateTitle, { color: c.foreground }]}>Application not found</Text>
        <Text style={[styles.stateBody, { color: c.mutedForeground }]}>
          This application may have been removed or is unavailable.
        </Text>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as any))}
          accessibilityRole="button"
          accessibilityLabel="Go back to applications"
          style={[styles.primaryButton, { backgroundColor: c.brand, marginTop: Space.md }]}>
          <Text style={[styles.primaryButtonText, { color: c.brandForeground }]}>Back to Tracker</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const currentApp = application;
  const pruned = isPrunedJob(currentApp);
  const companyName = currentApp.job?.company || currentApp.company_slug || 'Unknown company';
  const roleTitle = currentApp.role_title || currentApp.job?.title || 'Unknown role';
  const group = groupOf(currentApp);
  const currentStage = currentApp.stage;
  const currentStageLabel = currentStage ? stageLabel(currentStage) : group === 'saved' ? 'Saved' : 'Applied';
  const isSavedGroup = group === 'saved';
  const eligibleForApply = canMarkApplied(currentApp);
  const currentNotes = currentApp.notes ?? '';
  const activeNotes = notesDraft !== null ? notesDraft : currentNotes;
  const isNotesDirty = notesDraft !== null && notesDraft !== currentNotes;

  const silenceText = formatSilence(currentApp.days_silent, currentApp.silence_state);
  const appliedDate = formatDate(currentApp.applied_at);
  const followedUpAgo = currentApp.followed_up_at ? timeAgo(currentApp.followed_up_at) : null;
  const cvOpenedAgo = currentApp.cv_opened_at ? timeAgo(currentApp.cv_opened_at) : null;

  function handleMarkAppliedToday() {
    if (!currentApp.job?.public_slug) return;
    setConfirmModal({
      visible: true,
      title: 'Mark as applied today?',
      message: 'This will record today as your application date and move this job to Applied.',
      confirmText: 'Confirm Applied',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await markApplied(currentApp.job!.public_slug, currentApp.id);
        } catch (err) {
          showError('Error', err);
        }
      },
    });
  }

  function handleSetPreparing() {
    updateStage(currentApp.id, 'preparing').catch((err) => {
      showError('Error', err);
    });
  }

  function handleSelectStage(stage: TrackerStage) {
    updateStage(currentApp.id, stage, currentApp.notes).catch((err) => {
      showError('Error', err);
    });
  }

  async function handleSaveNotes() {
    try {
      await updateNotes(currentApp.id, activeNotes);
      setNotesDraft(null);
    } catch (err) {
      showError('Error', err);
    }
  }

  function handleMoveToSaved() {
    if (pruned || !currentApp.job?.public_slug) return;
    setConfirmModal({
      visible: true,
      title: 'Move to Saved?',
      message: 'This will clear application progress and keep the job in your Saved list.',
      confirmText: 'Move to Saved',
      confirmVariant: 'default',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await moveToSaved(currentApp.job!.public_slug, currentApp.id);
        } catch (err) {
          showError('Notice', err);
        }
      },
    });
  }

  function handleRemove() {
    setConfirmModal({
      visible: true,
      title: 'Remove from Tracker?',
      message: 'This will remove the application from your tracking board. Your view history is preserved.',
      confirmText: 'Remove',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await removeFromTracker(currentApp.id);
          if (router.canGoBack()) router.back();
          else router.replace('/' as any);
        } catch (err) {
          showError('Error', err);
        }
      },
    });
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.fill}>
        {/* Top Header */}
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <BackButton color={c.brandStrong} />
          <View style={styles.headerInfo}>
            <Text numberOfLines={1} style={[styles.headerRole, { color: c.foreground }]}>
              {roleTitle}
            </Text>
            <Text numberOfLines={1} style={[styles.headerCompany, { color: c.mutedForeground }]}>
              {companyName}
              {pruned ? ' · Posting closed' : ''}
            </Text>
          </View>
          {currentApp.job?.public_slug && !pruned ? (
            <Pressable
              onPress={() => router.push(`/jobs/${currentApp.job!.public_slug}`)}
              accessibilityRole="button"
              accessibilityLabel="View original job posting"
              style={[styles.viewJobBtn, { backgroundColor: c.muted }]}>
              <Text style={[styles.viewJobText, { color: c.brandStrong }]}>View Job</Text>
              <AppSymbol name="arrow.up.right" size={13} tintColor={c.brandStrong} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Company Card Header */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.companyRow}>
              <CompanyLogo name={companyName} size={44} />
              <View style={styles.companyMeta}>
                <Text style={[styles.roleTitle, { color: c.foreground }]}>{roleTitle}</Text>
                <Text style={[styles.companySubtitle, { color: c.mutedForeground }]}>{companyName}</Text>
              </View>
            </View>
          </View>

          {/* Lifecycle & Stage Management Card */}
          <TrackerStageCard
            currentStageLabel={currentStageLabel}
            appliedDate={appliedDate}
            eligibleForApply={eligibleForApply}
            isSavedGroup={isSavedGroup}
            isMarkingApplied={isMarkingApplied}
            isUpdatingStage={isUpdatingStage}
            onChangeStagePress={() => setIsPickerVisible(true)}
            onMarkAppliedToday={handleMarkAppliedToday}
            onSetPreparing={handleSetPreparing}
          />

          {/* Notes Card */}
          <TrackerNotesCard
            notes={activeNotes}
            isDirty={isNotesDirty}
            isSaving={isUpdatingNotes}
            onChangeNotes={setNotesDraft}
            onSaveNotes={handleSaveNotes}
          />

          {/* Signals & History Card */}
          <TrackerSignalsCard
            silenceText={silenceText}
            cvOpenedAgo={cvOpenedAgo}
            followedUpAgo={followedUpAgo}
            emailCount={currentApp.email_count}
          />

          {/* Secondary Actions / Danger Zone */}
          <TrackerActions
            showMoveToSaved={!isSavedGroup && !pruned}
            isMovingToSaved={isMovingToSaved}
            isRemoving={isRemoving}
            onMoveToSaved={handleMoveToSaved}
            onRemove={handleRemove}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Stage Picker Modal */}
      <ApplicationStagePicker
        visible={isPickerVisible}
        currentStage={currentStage}
        onSelectStage={handleSelectStage}
        onClose={() => setIsPickerVisible(false)}
      />

      {/* Themed Confirmation Modal */}
      {confirmModal ? (
        <ConfirmationModal
          visible={confirmModal.visible}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          confirmVariant={confirmModal.confirmVariant}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.xl,
    gap: Space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Space.sm,
  },
  back: {
    padding: Space.xs,
  },
  headerInfo: {
    flex: 1,
  },
  headerRole: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerCompany: {
    fontSize: 12,
  },
  viewJobBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.sm,
    paddingVertical: 5,
  },
  viewJobText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: Space.lg,
    gap: Space.md,
    paddingBottom: Space.xl,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.md,
    gap: Space.sm,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  companyMeta: {
    flex: 1,
    gap: 2,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  companySubtitle: {
    fontSize: 14,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  stateBody: {
    fontSize: 13,
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

