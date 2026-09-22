import meta from './split/meta.json';
import profiles from './split/profiles.json';
import questions from './split/questions.json';
import tiebreakers from './split/tiebreakers.json';
import type { QuizData } from '../types';

export const quizData = {
  ...meta,
  profiles,
  questions,
  tiebreakers,
} as unknown as QuizData;
