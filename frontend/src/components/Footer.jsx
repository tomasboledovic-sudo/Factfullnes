import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="site-footer-name">LearnFlow</span>
          <span className="site-footer-copy">© {year}</span>
        </div>
        <p className="site-footer-cookies">
          Táto stránka používa súbory cookie na zabezpečenie základnej funkčnosti, prihlásenie a zlepšenie
          používateľského zážitku. Podrobnosti súvisia so súhlasom v lište cookies.
        </p>
        <nav className="site-footer-nav" aria-label="Pätička">
          <Link to="/">Úvod</Link>
          <Link to="/login">Prihlásenie</Link>
          <Link to="/profile">Profil</Link>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
