import meta from './split/meta.json';
import profiles1 from './split/profiles-1.json';
import profiles2 from './split/profiles-2.json';
import profiles3 from './split/profiles-3.json';
import profiles4 from './split/profiles-4.json';
import profiles5 from './split/profiles-5.json';
import questions from './split/questions.json';
import tiebreakers from './split/tiebreakers.json';
import type { QuizData } from '../types';

export const quizData = {
  ...meta,
  profiles: { ...profiles1, ...profiles2, ...profiles3, ...profiles4, ...profiles5 },
  questions,
  tiebreakers,
} as unknown as QuizData;
