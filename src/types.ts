export type DimCode = string;
export type ScoreCode = Record<DimCode, number>;

export interface AnswerOption {
  text: string;
  code: ScoreCode;
}

export interface Question {
  id: string;
  text: string;
  answers: AnswerOption[];
}

export interface TieBreaker extends Question {
  targets: string[];
}

export interface CharacterCard {
  tagline: string;
  why: string;
  strengths: string;
  weaknesses: string;
  klass: string;
  origin: string;
  magic: string;
  likes: string;
  fact: string;
  quote: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  vector: Record<DimCode, number>;
  card: CharacterCard;
  asset: string;
  shareAsset: string;
}

export interface QuizData {
  mainDims: DimCode[];
  extraDims: DimCode[];
  dimNames: Record<DimCode, string>;
  profiles: Record<string, CharacterProfile>;
  profileOrder: string[];
  questions: Question[];
  tiebreakers: TieBreaker[];
}

export interface UserProfile {
  U: Record<DimCode, number>;
  C: Record<DimCode, number>;
  E: Record<DimCode, number>;
}

export interface RankedCharacter {
  id: string;
  d: number;
}

export interface AdaptiveAnswer {
  tbId: string;
  answer: number;
  candidateIdsBefore: string[];
}
