import type { AnswerOption } from '../types';

interface Props {
  question: string;
  answers: AnswerOption[];
  progress: number;
  canBack: boolean;
  selectedAnswer?: number;
  counterLabel: string;
  onAnswer: (index: number) => void;
  onBack: () => void;
}

export function QuizView({ question, answers, progress, canBack, selectedAnswer, counterLabel, onAnswer, onBack }: Props) {
  return (
    <main className="screen screen--quiz">
      <section className="quiz-shell">
        <header className="quiz-head">
          <button className="back-link" onClick={onBack} disabled={!canBack} aria-label="Вернуться к предыдущему вопросу">
            ‹ Назад
          </button>
          <div className="mini-seal" aria-hidden="true">А</div>
          <div className="question-counter" aria-label="Номер вопроса">{counterLabel}</div>
        </header>
        <div className="progress" aria-label="Ход испытания">
          <div className="progress__fill" style={{ width: `${Math.max(5, Math.min(100, progress * 100))}%` }} />
        </div>
        <p className="eyebrow quiz-eyebrow">Ситуация из жизни Академии</p>
        <h2 className="question">{question}</h2>
        <div className="answer-list">
          {answers.map((answer, index) => (
            <button
              key={index}
              className={`answer-card${selectedAnswer === index ? ' answer-card--selected' : ''}`}
              onClick={() => onAnswer(index)}
            >
              {answer.text}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
