import { quizData } from '../src/data';
import { createEngine, getInitialAdaptiveNeed, resolveAdaptive } from '../src/engine/scoring';
import type { AdaptiveAnswer, QuizData } from '../src/types';

const data = quizData as unknown as QuizData;
const engine = createEngine(data);

function greedyAnswers(targetId: string): number[] {
  const target = data.profiles[targetId].vector;
  const answers: number[] = [];
  for (let qi = 0; qi < data.questions.length; qi += 1) {
    let best = 0;
    let bestD = Infinity;
    for (let ai = 0; ai < data.questions[qi].answers.length; ai += 1) {
      const trial = [...answers, ai];
      while (trial.length < data.questions.length) trial.push(0);
      const { ranking } = getInitialAdaptiveNeed(engine, trial);
      const rank = ranking.findIndex((x) => x.id === targetId);
      const score = rank < 0 ? 999 : rank;
      const d = ranking.find((x) => x.id === targetId)?.d ?? 999;
      if (score * 10 + d < bestD) {
        bestD = score * 10 + d;
        best = ai;
      }
    }
    answers.push(best);
  }
  return answers;
}

const errors: string[] = [];
for (const id of data.profileOrder) {
  const answers = greedyAnswers(id);
  const base = getInitialAdaptiveNeed(engine, answers);
  if (!base.ranking.length) errors.push(`${id}: no ranking`);
  if (base.need) {
    const tb = data.tiebreakers.find((x) => x.id === base.need!.tbId)!;
    const adaptive: AdaptiveAnswer[] = [{ tbId: tb.id, answer: 0, candidateIdsBefore: base.need.candidateIds }];
    resolveAdaptive(engine, answers, base.need.candidateIds, adaptive);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Engine smoke test passed: ${data.profileOrder.length} profiles, ${data.questions.length} base questions, ${data.tiebreakers.length} tiebreakers.`);
