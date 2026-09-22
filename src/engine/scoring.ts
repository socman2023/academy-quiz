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

const EPS = 1e-9;

interface PreparedAnswer extends AnswerOption {
  score: Record<DimCode, number>;
}

interface PreparedQuestion extends Omit<Question, 'answers'> {
  dims: DimCode[];
  answers: PreparedAnswer[];
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
  // These are specialist musician results. The music elective makes them
  // eligible; it does not select either one by itself.
  return baseAnswers?.[10] === 0 ? 0 : 10;
}

export function distance(engine: EngineContext, profile: UserProfile, charId: string, baseAnswers?: number[]): number {
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
  return base + signaturePenalty(charId, baseAnswers);
}

export function rankAll(engine: EngineContext, profile: UserProfile, ids?: string[], baseAnswers?: number[]): RankedCharacter[] {
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

function chooseSpecificDivider(
  data: QuizData,
  ranking: RankedCharacter[],
  used: string[],
): { tb: TieBreaker; overlap: string[] } | null {
  const best = ranking[0]?.d;
  if (best === undefined) return null;
  const close = ranking
    .filter((x) => x.d - best < 0.04 + EPS)
    .slice(0, 4)
    .map((x) => x.id);

  const candidates = data.tiebreakers
    .filter((tb) => tb.id !== 'G' && !used.includes(tb.id))
    .map((tb) => {
      const overlap = close.filter((id) => tb.targets.includes(id));
      const containsBest = tb.targets.includes(ranking[0].id);
      const containsSecond = ranking[1] ? tb.targets.includes(ranking[1].id) : false;
      if (!containsBest || overlap.length < 2) return null;
      const score = overlap.length * 100 + (containsSecond ? 20 : 0) - tb.targets.length;
      return { tb, score, overlap };
    })
    .filter((x): x is { tb: TieBreaker; score: number; overlap: string[] } => Boolean(x))
    .sort((a, b) => b.score - a.score || a.tb.id.localeCompare(b.tb.id));

  return candidates[0] ? { tb: candidates[0].tb, overlap: candidates[0].overlap } : null;
}

export function getInitialAdaptiveNeed(
  engine: EngineContext,
  baseAnswers: number[],
): { profile: UserProfile; ranking: RankedCharacter[]; need: AdaptiveNeed | null } {
  const profile = computeBaseProfile(engine, baseAnswers);
  const ranking = rankAll(engine, profile, undefined, baseAnswers);
  const specific = chooseSpecificDivider(engine.data, ranking, []);
  if (specific) return { profile, ranking, need: { tbId: specific.tb.id, candidateIds: specific.overlap } };
  if (ranking[1] && ranking[1].d - ranking[0].d < 0.01 - EPS) {
    return { profile, ranking, need: { tbId: 'G', candidateIds: [ranking[0].id, ranking[1].id] } };
  }
  return { profile, ranking, need: null };
}

function locallyAdjustedProfile(
  engine: EngineContext,
  base: UserProfile,
  adaptiveAnswers: AdaptiveAnswer[],
): UserProfile {
  const U = { ...base.U };
  const evidence: Record<string, number[]> = {};
  for (const item of adaptiveAnswers) {
    const tb = tieBreakerById(engine.data, item.tbId);
    const code = tb.answers[item.answer]?.code ?? {};
    for (const [d, v] of Object.entries(code)) {
      const T = Math.max(1, Math.min(5, 3 + v));
      (evidence[d] ||= []).push(T);
    }
  }

  for (const [d, arr] of Object.entries(evidence)) {
    const baseCount = engine.data.mainDims.includes(d) ? 3 : 1;
    U[d] = (baseCount * base.U[d] + arr.reduce((s, x) => s + x, 0)) / (baseCount + arr.length);
  }
  return { U, C: { ...base.C }, E: { ...base.E } };
}

export function resolveAdaptive(
  engine: EngineContext,
  baseAnswers: number[],
  candidateIds: string[],
  adaptiveAnswers: AdaptiveAnswer[],
): AdaptiveResolution {
  const base = computeBaseProfile(engine, baseAnswers);
  const baseRanking = rankAll(engine, base, undefined, baseAnswers);
  const local = locallyAdjustedProfile(engine, base, adaptiveAnswers);
  const localRanking = rankAll(engine, local, candidateIds, baseAnswers);
  const used = adaptiveAnswers.map((x) => x.tbId);

  if (adaptiveAnswers.length >= 2) {
    let winnerId = localRanking[0].id;
    let secondId = localRanking[1]?.id;
    if (localRanking[1] && localRanking[1].d - localRanking[0].d < 0.01 - EPS) {
      const original = baseRanking.filter((x) => candidateIds.includes(x.id));
      winnerId = original[0].id;
      secondId = original[1]?.id ?? secondId;
    }
    return { kind: 'result', candidateIds, winnerId, secondId };
  }

  if (!localRanking[1] || localRanking[1].d - localRanking[0].d >= 0.01 - EPS) {
    return {
      kind: 'result',
      candidateIds,
      winnerId: localRanking[0].id,
      secondId: localRanking[1]?.id ?? baseRanking.find((x) => x.id !== localRanking[0].id)?.id,
    };
  }

  let next = chooseSpecificDivider(engine.data, localRanking, used);
  if (!next && !used.includes('G')) {
    next = { tb: tieBreakerById(engine.data, 'G'), overlap: [localRanking[0].id, localRanking[1].id] };
  }
  if (!next) {
    return {
      kind: 'result',
      candidateIds,
      winnerId: localRanking[0].id,
      secondId: localRanking[1]?.id,
    };
  }

  let nextCandidates = candidateIds;
  const overlap = candidateIds.filter((id) => next!.tb.targets.includes('*') || next!.tb.targets.includes(id));
  if (overlap.length >= 2 && overlap.includes(localRanking[0].id) && overlap.includes(localRanking[1].id)) {
    nextCandidates = overlap;
  }
  return { kind: 'question', candidateIds: nextCandidates, tbId: next.tb.id };
}
