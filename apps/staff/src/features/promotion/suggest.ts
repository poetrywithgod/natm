import { CLASS_LEVELS } from "../classes/api";

// A homeschool family has no admin sitting above the teacher to review each
// child, so the system proposes the outcome and the teacher confirms or
// overrides it. The proposal is deliberately simple and explainable: the
// child's average daily-log score for the term against a pass mark.
export const PASS_MARK = 50;

export interface PromotionSuggestion {
  decision: "promoted" | "repeated" | null;
  // Class the suggestion points at; null when there is none to point at yet
  // (e.g. the next level has no class created).
  toClassId: string | null;
  // Plain-language explanation shown to the teacher.
  reason: string;
}

interface ClassLike {
  id: string;
  name: string;
  level: string | null;
}

export function suggestPromotion(input: {
  score: number | null;
  currentClass: ClassLike | null;
  classes: ClassLike[];
}): PromotionSuggestion {
  const { score, currentClass, classes } = input;

  if (!currentClass) {
    return { decision: null, toClassId: null, reason: "This child is not in a class yet." };
  }
  if (score === null) {
    return {
      decision: null,
      toClassId: null,
      reason: "No daily log entries this term, so there is nothing to base a suggestion on. Decide manually.",
    };
  }

  if (score < PASS_MARK) {
    return {
      decision: "repeated",
      toClassId: currentClass.id,
      reason: `Term score ${score} is below the pass mark of ${PASS_MARK}. Suggest repeating ${currentClass.name}.`,
    };
  }

  const idx = CLASS_LEVELS.findIndex((l) => l.value === currentClass.level);
  const next = idx >= 0 && idx < CLASS_LEVELS.length - 1 ? CLASS_LEVELS[idx + 1] : null;
  if (!next) {
    return {
      decision: null,
      toClassId: null,
      reason: `Term score ${score} passes, but ${currentClass.name} has no level above it. Decide manually.`,
    };
  }
  const target = classes.find((c) => c.level === next.value);
  if (!target) {
    return {
      decision: "promoted",
      toClassId: null,
      reason: `Term score ${score} passes. Create a ${next.label} class under Classes & levels, then promote.`,
    };
  }
  return {
    decision: "promoted",
    toClassId: target.id,
    reason: `Term score ${score} passes the pass mark of ${PASS_MARK}. Suggest promoting to ${target.name}.`,
  };
}
