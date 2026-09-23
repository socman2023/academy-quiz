import type {
  AdaptiveAnswer,
  AnswerOption,
  DimCode,
  Question,
  QuizData,
  RankedCharacter,
  TieBreaker,
  UserProfile,
} from '../types';
import {
  BASE_TIE_GAP,
  CHARACTER_CALIBRATION,
  MUSIC_SOFT_PENALTY,
  POST_TIE_GAP,
  TIEBREAKER_WEIGHT,
} from './calibration';

const EPS = 1e-9;

interface PreparedAnswer extends AnswerOption {
  score: Record<DimCode, number>;
}

interface PreparedQuestion extends Omit<Question, 'answers'> {
  dims: DimCode[];
  answers: PreparedAnswer[];
}

interface DividerChoice {
  tb: TieBreaker;
  score: number;
}

export interface EngineContext {
  data: QuizData;
  allDims: DimCode[];
  preparedQuestions: PreparedQuestion[];
  meta: {
    mplus: Record<DimCode, number>;
    mminus: Record<DimCode, number>;
    n: Record<DimCode, number>;
  };
}

export interface AdaptiveNeed {
  tbId: string;
  candidateIds: string[];
}

export interface AdaptiveResolution {
  kind: 'question' | 'result';
  tbId?: string;
  candidateIds: string[];
  winnerId?: string;
  secondId?: string;
}

function prepareQuestions(data: QuizData): PreparedQuestion[] {
  return data.questions.map((q) => {
    const dims = [...new Set(q.answers.flatMap((a) => Object.keys(a.code)))];
    const means: Record<string, number> = {};
    for (const dim of dims) {
      means[dim] = q.answers.reduce((sum, a) => sum + (a.code[dim] || 0), 0) / q.answers.length;
    }
    const centered = q.answers.map((a) => {
      const vector: Record<string, number> = {};
      for (const dim of dims) vector[dim] = (a.code[dim] || 0) - means[dim];
      return vector;
    });
    const maxNorm = Math.max(
      ...centered.map((v) => Math.sqrt(dims.reduce((sum, d) => sum + v[d] * v[d], 0))),
      EPS,
    );
    const scale = 1 / maxNorm;
    const answers = q.answers.map((a, i) => ({
      ...a,
      score: Object.fromEntries(dims.map((dim) => [dim, centered[i][dim] * scale])),
    }));
    return { ...q, dims, answers };
  });
}

export function createEngine(data: QuizData): EngineContext {
  const allDims = [...data.mainDims, ...data.extraDims];
  const preparedQuestions = prepareQuestions(data);
  const mplus = Object.fromEntries(allDims.map((d) => [d, 0])) as Record<string, number>;
  const mminus = Object.fromEntries(allDims.map((d) => [d, 0])) as Record<string, number>;
  const n = Object.fromEntries(allDims.map((d) => [d, 0])) as Record<string, number>;

  for (const q of preparedQuestions) {
    for (const dim of q.dims) {
      const vals = q.answers.map((a) => a.score[dim] || 0);
      mplus[dim] += Math.max(0, ...vals);
      mminus[dim] += Math.abs(Math.min(0, ...vals));
      n[dim] += 1;
    }
  }

  return { data, allDims, preparedQuestions, meta: { mplus, mminus, n } };
}

export function computeBaseProfile(engine: EngineContext, baseAnswers: number[]): UserProfile {
  const { allDims, data, preparedQuestions, meta } = engine;
  const E = Object.fromEntries(allDims.map((d) => [d, 0])) as Record<string, number>;

  preparedQuestions.forEach((q, qi) => {
    const ai = baseAnswers[qi];
    if (ai === undefined) return;
    const score = q.answers[ai]?.score;
    if (!score) return;
    for (const [d, v] of Object.entries(score)) E[d] += v;
  });

  const U: Record<string, number> = {};
  const C: Record<string, number> = {};
  for (const d of allDims) {
    const e = E[d];
    if (e >= 0) U[d] = meta.mplus[d] > EPS ? 3 + 2 * (e / meta.mplus[d]) : 3;
    else U[d] = meta.mminus[d] > EPS ? 3 + 2 * (e / meta.mminus[d]) : 3;
    U[d] = Math.max(1, Math.min(5, U[d]));
    const target = data.mainDims.includes(d) ? 3 : 2;
    C[d] = Math.min(1, meta.n[d] / target);
  }
  return { U, C, E };
}

function signaturePenalty(charId: string, baseAnswers?: number[]): number {
  if (charId !== 'iliodor' && charId !== 'evstatiy') return 0;
  // Within the CURRENT 25-result set these two results are strongly tied to
  // explicit musical interest. This is a soft signal, not a claim that they
  // are the only musical students in the Academy (Keivan is musical too).
  return baseAnswers?.[10] === 0 ? 0 : MUSIC_SOFT_PENALTY;
}

export function distance(
  engine: EngineContext,
  profile: UserProfile,
  charId: string,
  baseAnswers?: number[],
): number {
  const { data, allDims } = engine;
  const p = data.profiles[charId].vector;
  let num = 0;
  let den = 0;
  for (const d of allDims) {
    const w = data.mainDims.includes(d) ? 1 : 0.35;
    const c = profile.C[d] ?? 0;
    if (c <= 0) continue;
    const diff = ((profile.U[d] ?? 3) - p[d]) / 4;
    num += w * c * diff * diff;
    den += w * c;
  }
  const base = den > 0 ? Math.sqrt(num / den) : 1;
  return base
    + (CHARACTER_CALIBRATION[charId] ?? 0)
    + signaturePenalty(charId, baseAnswers);
}

export function rankAll(
  engine: EngineContext,
  profile: UserProfile,
  ids?: string[],
  baseAnswers?: number[],
): RankedCharacter[] {
  const pool = ids ?? engine.data.profileOrder;
  return pool
    .map((id) => ({ id, d: distance(engine, profile, id, baseAnswers) }))
    .sort((a, b) => a.d - b.d || engine.data.profileOrder.indexOf(a.id) - engine.data.profileOrder.indexOf(b.id));
}

function tieBreakerById(data: QuizData, id: string): TieBreaker {
  const tb = data.tiebreakers.find((x) => x.id === id);
  if (!tb) throw new Error(`Unknown tiebreaker ${id}`);
  return tb;
}

function dividerAppliesToPair(tb: TieBreaker, a: string, b: string): boolean {
  return tb.targets.includes('*') || (tb.targets.includes(a) && tb.targets.includes(b));
}

function applyTieBreakerAnswer(
  engine: EngineContext,
  profile: UserProfile,
  tb: TieBreaker,
  answer: number,
): UserProfile {
  const code = tb.answers[answer]?.code ?? {};
  const U = { ...profile.U };
  const C = { ...profile.C };

  for (const [d, v] of Object.entries(code)) {
    const baseCount = engine.data.mainDims.includes(d) ? 3 : 1;
    const target = Math.max(1, Math.min(5, 3 + v));
    U[d] = (
      baseCount * (U[d] ?? 3)
      + TIEBREAKER_WEIGHT * target
    ) / (baseCount + TIEBREAKER_WEIGHT);
    C[d] = 1;
  }

  return { U, C, E: { ...profile.E } };
}

function chooseEffectiveDivider(
  engine: EngineContext,
  profile: UserProfile,
  baseAnswers: number[],
  pair: [string, string],
  used: Set<string>,
): DividerChoice | null {
  const [a, b] = pair;
  let best: DividerChoice | null = null;

  for (const tb of engine.data.tiebreakers) {
    if (used.has(tb.id) || !dividerAppliesToPair(tb, a, b)) continue;

    let winsA = 0;
    let winsB = 0;
    let spread = 0;

    for (let answer = 0; answer < tb.answers.length; answer += 1) {
      const adjusted = applyTieBreakerAnswer(engine, profile, tb, answer);
      const pairRanking = rankAll(engine, adjusted, [a, b], baseAnswers);
      if (pairRanking[0].id === a) winsA += 1;
      else winsB += 1;
      spread += Math.abs(pairRanking[1].d - pairRanking[0].d);
    }

    // Never ask a question if every possible answer produces the same winner.
    if (winsA === 0 || winsB === 0) continue;

    // Prefer a question whose answer space is balanced between the two
    // candidates; use separation strength only as a secondary criterion.
    const score = Math.min(winsA, winsB) * 100 + spread;
    if (!best || score > best.score) best = { tb, score };
  }

  return best;
}

export function getInitialAdaptiveNeed(
  engine: EngineContext,
  baseAnswers: number[],
): { profile: UserProfile; ranking: RankedCharacter[]; need: AdaptiveNeed | null } {
  const profile = computeBaseProfile(engine, baseAnswers);
  const ranking = rankAll(engine, profile, undefined, baseAnswers);

  if (!ranking[1] || ranking[1].d - ranking[0].d >= BASE_TIE_GAP - EPS) {
    return { profile, ranking, need: null };
  }

  const pair: [string, string] = [ranking[0].id, ranking[1].id];
  const divider = chooseEffectiveDivider(engine, profile, baseAnswers, pair, new Set());
  if (!divider) return { profile, ranking, need: null };

  return {
    profile,
    ranking,
    need: { tbId: divider.tb.id, candidateIds: pair },
  };
}

function applyAdaptiveAnswers(
  engine: EngineContext,
  base: UserProfile,
  adaptiveAnswers: AdaptiveAnswer[],
): UserProfile {
  let current = base;
  for (const item of adaptiveAnswers) {
    current = applyTieBreakerAnswer(
      engine,
      current,
      tieBreakerById(engine.data, item.tbId),
      item.answer,
    );
  }
  return current;
}

export function resolveAdaptive(
  engine: EngineContext,
  baseAnswers: number[],
  candidateIds: string[],
  adaptiveAnswers: AdaptiveAnswer[],
): AdaptiveResolution {
  if (candidateIds.length < 2) {
    const profile = computeBaseProfile(engine, baseAnswers);
    const ranking = rankAll(engine, profile, undefined, baseAnswers);
    return {
      kind: 'result',
      candidateIds,
      winnerId: candidateIds[0] ?? ranking[0].id,
      secondId: ranking[1]?.id,
    };
  }

  const pair: [string, string] = [candidateIds[0], candidateIds[1]];
  const base = computeBaseProfile(engine, baseAnswers);
  const adjusted = applyAdaptiveAnswers(engine, base, adaptiveAnswers);
  const pairRanking = rankAll(engine, adjusted, pair, baseAnswers);

  if (
    adaptiveAnswers.length >= 2
    || !pairRanking[1]
    || pairRanking[1].d - pairRanking[0].d >= POST_TIE_GAP - EPS
  ) {
    return {
      kind: 'result',
      candidateIds: pair,
      winnerId: pairRanking[0].id,
      secondId: pairRanking[1]?.id,
    };
  }

  const used = new Set(adaptiveAnswers.map((x) => x.tbId));
  const divider = chooseEffectiveDivider(engine, adjusted, baseAnswers, pair, used);

  if (!divider) {
    return {
      kind: 'result',
      candidateIds: pair,
      winnerId: pairRanking[0].id,
      secondId: pairRanking[1]?.id,
    };
  }

  return {
    kind: 'question',
    candidateIds: pair,
    tbId: divider.tb.id,
  };
}
