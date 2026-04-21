import './QuestionCard.css';

function QuestionCard({ question, selectedAnswer, onAnswer }) {
  const text = question?.questionText ?? question?.question ?? '';
  const options = Array.isArray(question?.options) ? question.options : [];

  return (
    <div className="question-card">
      <h3 className="question-text">{text}</h3>
      
      <div className="options-list">
        {options.map((option, index) => (
          <button
            key={index}
            className={`option-button ${selectedAnswer === index ? 'selected' : ''}`}
            onClick={() => onAnswer(index)}
          >
            <span className="option-letter">
              {String.fromCharCode(65 + index)}
            </span>
            <span className="option-text">{option}</span>
            {selectedAnswer === index && (
              <span className="option-check">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuestionCard;

