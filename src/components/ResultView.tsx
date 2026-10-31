import type { CharacterProfile } from '../types';

interface Props {
  profile: CharacterProfile;
  status?: string;
  onShareStory: () => void;
  inVK: boolean;
  onInvite: () => void;
  onRestart: () => void;
}

export function ResultView({ profile, status, inVK, onShareStory, onInvite, onRestart }: Props) {
  const c = profile.card;

  return (
    <main className="screen screen--result">
      <section className="result-shell">
        <div className="result-portrait-wrap">
          <img className="result-portrait" src={profile.asset} alt={`Портрет: ${profile.name}`} />
          <div className="result-portrait-shade" />
          <div className="result-badge">Твой результат</div>
        </div>

        <div className="result-content">
          <h1 className="result-name">Ты — {profile.name}</h1>
          <p className="result-meta">Класс {c.klass} · {c.origin}</p>
          <p className="result-tagline">{c.tagline}</p>

          <article className="story-block story-block--lead">
            <h2>Почему именно он</h2>
            <p>{c.why}</p>
          </article>

          <div className="result-columns">
            <article className="story-block">
              <h2>Твои сильные стороны</h2>
              <p>{c.strengths}</p>
            </article>
            <article className="story-block">
              <h2>Что иногда мешает</h2>
              <p>{c.weaknesses}</p>
            </article>
          </div>

          <dl className="facts">
            <div><dt>Магия</dt><dd>{c.magic}</dd></div>
            <div><dt>Что любит</dt><dd>{c.likes}</dd></div>
          </dl>

          <div className="homeland"><strong>Факт о родине:</strong> {c.fact}</div>
          <blockquote className="olesha-quote"><strong>Олешка говорит:</strong><br />{c.quote}</blockquote>

          <div className="result-actions">
            <button className="action action--primary" onClick={onShareStory}>{inVK ? 'Похвастаться результатом' : 'Скачать карточку результата'}</button>
            <button className="action action--secondary" onClick={onInvite}>Позвать друга в Академию</button>
            <button className="action action--ghost" onClick={onRestart}>Испытать судьбу ещё раз</button>
          </div>
          {status ? <p className="action-status" role="status">{status}</p> : null}
        </div>
      </section>
    </main>
  );
}
