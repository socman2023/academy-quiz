interface Props {
  onStart: () => void;
}

export function StartView({ onStart }: Props) {
  return (
    <main className="screen screen--start">
      <div className="start-overlay" />
      <section className="start-card">
        <div className="academy-seal" aria-hidden="true">А</div>
        <p className="eyebrow">Испытание Академии</p>
        <h1>Кто ты из учеников Академии?</h1>
        <p className="start-lead">
          Представь, что ты уже учишься в Академии. Выбирай, как поступил бы ты в разных ситуациях,
          — и узнай, на кого из её учеников похож больше всего.
        </p>
        <p className="start-note">Здесь нет правильных и неправильных ответов.</p>
        <button className="action action--primary action--large" onClick={onStart}>
          Пройти испытание
        </button>
      </section>
    </main>
  );
}
