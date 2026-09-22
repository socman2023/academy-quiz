import raw from './quiz-data.json';
import type { QuizData } from '../types';

export const quizData = raw as unknown as QuizData;
