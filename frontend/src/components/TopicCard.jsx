import './TopicCard.css';

function TopicCard({ topic, onStart }) {
  const topicEmojis = {
    'Čo sú to mocniny?': '🔢',
    'Čo sú to vektory?': '📐',
    'Percentá a zľavy v obchode': '🏷️',
    'Pravdepodobnosť v každodennom živote': '🎲',
    'Ako si správne vystretchovať svaly': '🧘',
    'List vs Set vs Map vs Vector': '💻',
    'Základy fotosyntézy': '🌱',
    'Úvod do investovania': '📈',
    'Zdravý spánok (základy)': '💤',
    'Ako čítať výživové tabuľky': '📋',
    'Základy investovania: riziko vs. výnos': '📊',
    'Digitálna bezpečnosť pre bežného človeka': '🔐',
    'Klimatické zmeny: fakty a zjednodušenia': '🌍',
    'Efektívne učenie': '📚',
    'Základy prvej pomoci (orientačne)': '🩹'
  };

  const getEmoji = () => {
    return topicEmojis[topic.title] || topic.title.charAt(0);
  };

  return (
    <div className="topic-card" onClick={() => onStart(topic.id)}>
      <div className={`topic-icon-wrapper ${topic.difficulty}`}>
        {getEmoji()}
      </div>

      <h3 className="topic-title">{topic.title}</h3>
      <p className="topic-description">{topic.description}</p>
      
      <button className="topic-button">
        Začať
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 8h10M9 4l4 4-4 4"/>
        </svg>
      </button>
    </div>
  );
}

export default TopicCard;
