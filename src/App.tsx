import { useEffect, useMemo, useState } from 'react';
import { StartView } from './components/StartView';
import { QuizView } from './components/QuizView';
import { ResultView } from './components/ResultView';
import { quizData } from './data';
import { createEngine, getInitialAdaptiveNeed, resolveAdaptive } from './engine/scoring';
import { inviteFriend, shareResult } from './lib/vk';
import type { AdaptiveAnswer } from './types';

const STORAGE_KEY = 'academy-quiz-session-v1';

type Phase = 'start' | 'base' | 'adaptive' | 'result';

interface QuizState {
  phase: Phase;
  baseAnswers: number[];
  adaptive: AdaptiveAnswer[];
  candidateIds: string[];
  currentTbId: string | null;
  winnerId: string | null;
}

const initialState: QuizState = {
  phase: 'start',
  baseAnswers: [],
  adaptive: [],
  candidateIds: [],
  currentTbId: null,
  winnerId: null,
};

function loadState(): QuizState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as QuizState;
    if (!parsed || !Array.isArray(parsed.baseAnswers)) return initialState;
    return parsed;
  } catch {
    return initialState;
  }
}

function wallAssetFromStory(storyAsset: string): string {
  return storyAsset.replace('/share/', '/share/wall/');
}

export default function App() {
  const engine = useMemo(() => createEngine(quizData), []);
  const [state, setState] = useState<QuizState>(() => loadState());
  const [status, setStatus] = useState('');

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.phase, state.baseAnswers.length, state.adaptive.length]);

  const start = () => {
    setStatus('');
    setState({ ...initialState, phase: 'base' });
  };

  const finishBase = (baseAnswers: number[]) => {
    const { ranking, need } = getInitialAdaptiveNeed(engine, baseAnswers);
    if (!need) {
      setState({
        phase: 'result',
        baseAnswers,
        adaptive: [],
        candidateIds: [],
        currentTbId: null,
        winnerId: ranking[0].id,
      });
      return;
    }
    setState({
      phase: 'adaptive',
      baseAnswers,
      adaptive: [],
      candidateIds: need.candidateIds,
      currentTbId: need.tbId,
      winnerId: null,
    });
  };

  const answerBase = (answer: number) => {
    const baseAnswers = [...state.baseAnswers, answer];
    if (baseAnswers.length < quizData.questions.length) {
      setState((s) => ({ ...s, baseAnswers }));
      return;
    }
    finishBase(baseAnswers);
  };

  const answerAdaptive = (answer: number) => {
    if (!state.currentTbId) return;
    const adaptive = [
      ...state.adaptive,
      { tbId: state.currentTbId, answer, candidateIdsBefore: [...state.candidateIds] },
    ];
    const resolution = resolveAdaptive(engine, state.baseAnswers, state.candidateIds, adaptive);
    if (resolution.kind === 'result') {
      setState((s) => ({
        ...s,
        phase: 'result',
        adaptive,
        candidateIds: resolution.candidateIds,
        currentTbId: null,
        winnerId: resolution.winnerId ?? null,
      }));
      return;
    }
    setState((s) => ({
      ...s,
      adaptive,
      candidateIds: resolution.candidateIds,
      currentTbId: resolution.tbId ?? null,
    }));
  };

  const goBack = () => {
    setStatus('');
    if (state.phase === 'base') {
      if (state.baseAnswers.length === 0) {
        setState(initialState);
        return;
      }
      setState((s) => ({ ...s, baseAnswers: s.baseAnswers.slice(0, -1) }));
      return;
    }
    if (state.phase === 'adaptive') {
      if (state.adaptive.length === 0) {
        setState({
          phase: 'base',
          baseAnswers: state.baseAnswers.slice(0, -1),
          adaptive: [],
          candidateIds: [],
          currentTbId: null,
          winnerId: null,
        });
        return;
      }
      const last = state.adaptive[state.adaptive.length - 1];
      setState((s) => ({
        ...s,
        adaptive: s.adaptive.slice(0, -1),
        candidateIds: last.candidateIdsBefore,
        currentTbId: last.tbId,
      }));
    }
  };

  const restart = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setStatus('');
    setState({ ...initialState, phase: 'base' });
  };

  if (state.phase === 'start') return <StartView onStart={start} />;

  if (state.phase === 'result' && state.winnerId) {
    const profile = quizData.profiles[state.winnerId];
    return (
      <ResultView
        profile={profile}
        status={status}
        onShareStory={async () => {
          try {
            const result = await shareResult(profile.name, profile.shareAsset, wallAssetFromStory(profile.shareAsset), 'story');
            if (result === 'cancelled') setStatus('');
            else setStatus(result === 'copied' ? 'Ссылка на испытание скопирована.' : 'Окно публикации истории открыто.');
          } catch {
            setStatus('Не удалось открыть публикацию истории. Попробуй ещё раз.');
          }
        }}
        onShareWall={async () => {
          try {
            const result = await shareResult(profile.name, profile.shareAsset, wallAssetFromStory(profile.shareAsset), 'wall');
            if (result === 'cancelled') setStatus('');
            else setStatus(result === 'copied' ? 'Ссылка на испытание скопирована.' : 'Окно публикации на странице открыто.');
          } catch {
            setStatus('Не удалось открыть публикацию на странице. Попробуй ещё раз.');
          }
        }}
        onInvite={async () => {
          try {
            const result = await inviteFriend();
            setStatus(result === 'copied' ? 'Ссылка на испытание скопирована.' : 'Приглашение открыто.');
          } catch {
            setStatus('Не удалось открыть приглашение. Попробуй ещё раз.');
          }
        }}
        onRestart={restart}
      />
    );
  }

  if (state.phase === 'adaptive' && state.currentTbId) {
    const q = quizData.tiebreakers.find((x) => x.id === state.currentTbId);
    if (!q) throw new Error(`Unknown tiebreaker ${state.currentTbId}`);
    const progress = state.adaptive.length === 0 ? 0.95 : 0.985;
    return (
      <QuizView
        question={q.text}
        answers={q.answers}
        progress={progress}
        counterLabel="12/12 · уточнение"
        canBack
        onAnswer={answerAdaptive}
        onBack={goBack}
      />
    );
  }

  const index = state.baseAnswers.length;
  const q = quizData.questions[index];
  const progress = 0.06 + (index / quizData.questions.length) * 0.84;
  return (
    <QuizView
      question={q.text}
      answers={q.answers}
      progress={progress}
      counterLabel={`${index + 1}/${quizData.questions.length}`}
      canBack
      onAnswer={answerBase}
      onBack={goBack}
    />
  );
}
