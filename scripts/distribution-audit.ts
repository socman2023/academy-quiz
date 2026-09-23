import { quizData } from '../src/data';
import {
  createEngine,
  getInitialAdaptiveNeed,
  resolveAdaptive,
} from '../src/engine/scoring';
import type { AdaptiveAnswer } from '../src/types';

const engine = createEngine(quizData);
const N = 100_000;
let seed = 192837465;

function rnd(): number {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
}

function randomBaseAnswers(): number[] {
  return quizData.questions.map((q) => Math.floor(rnd() * q.answers.length));
}

function randomAnswer(tbId: string): number {
  const tb = quizData.tiebreakers.find((x) => x.id === tbId);
  if (!tb) throw new Error(`Missing tiebreaker ${tbId}`);
  return Math.floor(rnd() * tb.answers.length);
}

function allFinalWinners(
  baseAnswers: number[],
  candidateIds: string[],
  firstTbId: string,
): Set<string> {
  const winners = new Set<string>();
  const first = quizData.tiebreakers.find((x) => x.id === firstTbId);
  if (!first) throw new Error(`Missing tiebreaker ${firstTbId}`);

  for (let a = 0; a < first.answers.length; a += 1) {
    const one: AdaptiveAnswer[] = [{
      tbId: firstTbId,
      answer: a,
      candidateIdsBefore: [...candidateIds],
    }];
    const r1 = resolveAdaptive(engine, baseAnswers, candidateIds, one);

    if (r1.kind === 'result') {
      if (r1.winnerId) winners.add(r1.winnerId);
      continue;
    }

    const second = quizData.tiebreakers.find((x) => x.id === r1.tbId);
    if (!second) throw new Error(`Missing second tiebreaker ${r1.tbId}`);

    for (let b = 0; b < second.answers.length; b += 1) {
      const two: AdaptiveAnswer[] = [
        ...one,
        {
          tbId: second.id,
          answer: b,
          candidateIdsBefore: [...r1.candidateIds],
        },
      ];
      const r2 = resolveAdaptive(engine, baseAnswers, r1.candidateIds, two);
      if (r2.kind !== 'result' || !r2.winnerId) {
        throw new Error('Adaptive flow failed to terminate after two questions');
      }
      winners.add(r2.winnerId);
    }
  }

  return winners;
}

const counts = Object.fromEntries(quizData.profileOrder.map((id) => [id, 0])) as Record<string, number>;
let noExtra = 0;
let oneExtra = 0;
let twoExtra = 0;
let changedByExtra = 0;
let auditedClarifications = 0;

for (let i = 0; i < N; i += 1) {
  const baseAnswers = randomBaseAnswers();
  const initial = getInitialAdaptiveNeed(engine, baseAnswers);
  const initialWinner = initial.ranking[0].id;

  if (!initial.need) {
    counts[initialWinner] += 1;
    noExtra += 1;
    continue;
  }

  auditedClarifications += 1;
  const possible = allFinalWinners(
    baseAnswers,
    initial.need.candidateIds,
    initial.need.tbId,
  );
  if (possible.size < 2) {
    throw new Error(
      `Useless clarification detected: ${initial.need.tbId} for ${initial.need.candidateIds.join(' / ')}`,
    );
  }

  const adaptive: AdaptiveAnswer[] = [{
    tbId: initial.need.tbId,
    answer: randomAnswer(initial.need.tbId),
    candidateIdsBefore: [...initial.need.candidateIds],
  }];

  let resolution = resolveAdaptive(
    engine,
    baseAnswers,
    initial.need.candidateIds,
    adaptive,
  );

  if (resolution.kind === 'question') {
    adaptive.push({
      tbId: resolution.tbId!,
      answer: randomAnswer(resolution.tbId!),
      candidateIdsBefore: [...resolution.candidateIds],
    });
    resolution = resolveAdaptive(
      engine,
      baseAnswers,
      resolution.candidateIds,
      adaptive,
    );
    twoExtra += 1;
  } else {
    oneExtra += 1;
  }

  if (resolution.kind !== 'result' || !resolution.winnerId) {
    throw new Error('Adaptive flow did not terminate');
  }

  counts[resolution.winnerId] += 1;
  if (resolution.winnerId !== initialWinner) changedByExtra += 1;
}

const rows = quizData.profileOrder
  .map((id) => ({
    id,
    name: quizData.profiles[id].name,
    pct: 100 * counts[id] / N,
  }))
  .sort((a, b) => b.pct - a.pct);

console.table(rows.map((x) => ({
  character: x.name,
  percent: x.pct.toFixed(3),
})));

const min = rows[rows.length - 1];
const max = rows[0];
console.log({
  noExtraPct: (100 * noExtra / N).toFixed(2),
  oneExtraPct: (100 * oneExtra / N).toFixed(2),
  twoExtraPct: (100 * twoExtra / N).toFixed(2),
  anyExtraPct: (100 * (oneExtra + twoExtra) / N).toFixed(2),
  changedByExtraPct: (100 * changedByExtra / N).toFixed(2),
  auditedClarifications,
  min: { name: min.name, pct: min.pct.toFixed(3) },
  max: { name: max.name, pct: max.pct.toFixed(3) },
});

if (min.pct < 1) {
  throw new Error(`Hard frequency floor failed: ${min.name} = ${min.pct.toFixed(3)}%`);
}
if (min.pct < 2 || max.pct > 9) {
  throw new Error(
    `Preferred calibration band failed: min=${min.pct.toFixed(3)}%, max=${max.pct.toFixed(3)}%`,
  );
}
