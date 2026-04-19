import './CookieBanner.css';

function CookieBanner({ onAccept }) {
  return (
    <div className="cookie-banner" role="dialog" aria-label="Informácia o cookies">
      <div className="cookie-banner-inner">
        <p className="cookie-banner-text">
          <strong>Cookies.</strong> Používame nevyhnutné cookies na prevádzku aplikácie (napr. relácia,
          bezpečnosť). Voliteľné analytické alebo marketingové cookies nepoužívame bez vášho súhlasu.
          Pokračovaním v používaní stránky po kliknutí na „Súhlasím“ beriete na vedomie použitie
          nevyhnutných cookies.
        </p>
        <div className="cookie-banner-actions">
          <button type="button" className="cookie-banner-btn cookie-banner-btn-primary" onClick={onAccept}>
            Súhlasím
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieBanner;
