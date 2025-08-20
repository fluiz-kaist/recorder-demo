import { RoundSummary, ParticipationRound } from "@/types/user";
export function getDisplaySetId(
  round: RoundSummary | ParticipationRound
): number {
  return round.formalSetId ?? round.setId ?? 1;
}
