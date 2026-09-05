import { useCallback, useState } from 'react';

import {
  avoidSkillInProfile,
  claimSkillInProfile,
  unavoidSkillInProfile,
  unclaimSkillInProfile,
} from './profileEdit';
import { useProfile } from './useProfile';
import { useProfileWrites } from './useProfileWrites';

/** The last write, which the confirmation names and undo reverses. Only a claim
 *  moved the match, so only a claim needs the block to re-read it afterwards. */
export type LastWrite = { kind: 'claim' | 'avoid' | 'unavoid'; skill: string };

/**
 * The four one-skill writes the match block's chips produce, plus the avoided
 * set they are marked against.
 *
 * The avoided set is read off the profile the block already holds, so a skill
 * marked as avoided on one job is marked on every other job asking for it
 * without a further request.
 *
 * Undo subtracts the one skill it names rather than restoring the profile as it
 * was — restoring a snapshot would roll back any write made after the one being
 * undone.
 */
export function useSkillClaims() {
  const { data: profile } = useProfile();
  const write = useProfileWrites();

  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [last, setLast] = useState<LastWrite | null>(null);

  const avoided = new Set((profile?.excluded_skills ?? []).map((s) => s.toLowerCase()));

  const run = useCallback(
    async (entry: LastWrite, invalidateMatches: boolean) => {
      setPending(true);
      setFailed(null);
      try {
        await write(
          (current) =>
            entry.kind === 'claim'
              ? claimSkillInProfile(current, entry.skill)
              : entry.kind === 'avoid'
                ? avoidSkillInProfile(current, entry.skill)
                : unavoidSkillInProfile(current, entry.skill),
          { invalidateMatches },
        );
        setLast(entry);
        return true;
      } catch {
        setFailed(entry.skill);
        return false;
      } finally {
        setPending(false);
      }
    },
    [write],
  );

  /** A claim changes what the viewer holds, so every cached match is now wrong. */
  const claim = useCallback((skill: string) => run({ kind: 'claim', skill }, true), [run]);

  /** An avoid changes nothing the match is computed from — the server scores held
   *  skills alone — so nothing is invalidated and nothing is refetched. */
  const avoid = useCallback((skill: string) => run({ kind: 'avoid', skill }, false), [run]);

  const unavoid = useCallback((skill: string) => run({ kind: 'unavoid', skill }, false), [run]);

  /** Reverse the last write, naming only its own skill. */
  const undo = useCallback(async () => {
    if (!last) return false;
    setPending(true);
    setFailed(null);
    try {
      await write(
        (current) =>
          last.kind === 'claim'
            ? unclaimSkillInProfile(current, last.skill)
            : last.kind === 'avoid'
              ? unavoidSkillInProfile(current, last.skill)
              : avoidSkillInProfile(current, last.skill),
        { invalidateMatches: last.kind === 'claim' },
      );
      setLast(null);
      return true;
    } catch {
      setFailed(last.skill);
      return false;
    } finally {
      setPending(false);
    }
  }, [last, write]);

  return { avoided, claim, avoid, unavoid, undo, pending, failed, last };
}
