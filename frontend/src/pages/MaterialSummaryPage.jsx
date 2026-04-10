import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import Navigation from '../components/Navigation';
import './MaterialSummaryPage.css';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type) {
  if (type?.includes('pdf')) return '📄';
  if (type?.startsWith('image/')) return '🖼️';
  if (type?.includes('text')) return '📝';
  return '📎';
}

export default function MaterialSummaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [loadingFile, setLoadingFile] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFile();
  }, [id]);

  useEffect(() => {
    if (file && !summary && !loadingSummary) {
      generateSummary();
    }
  }, [file]);

  async function fetchFile() {
    setLoadingFile(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/files`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      const found = data.data.find(f => String(f.id) === String(id));
      if (!found) throw new Error('Súbor nebol nájdený');
      setFile(found);
    } catch (e) {
      setError(e.message || 'Nepodarilo sa načítať súbor');
    } finally {
      setLoadingFile(false);
    }
  }

  async function generateSummary() {
    if (!file) return;
    setLoadingSummary(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch(`${API_BASE_URL}/files/${file.id}/summarize`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Zhrnutie sa nepodarilo vygenerovať');
      setSummary(data.data.summary);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingSummary(false);
    }
  }

  return (
    <div className="summary-page">
      <Navigation />

      <div className="summary-container">
        <div className="summary-header">
          <button className="back-btn" onClick={() => navigate('/admin')}>
            ← Späť na Admin
          </button>
          <h1>AI Zhrnutie</h1>
        </div>

        {loadingFile ? (
          <div className="summary-loading">
            <div className="loading-spinner" />
            <span>Načítavam súbor...</span>
          </div>
        ) : error && !file ? (
          <div className="summary-error">{error}</div>
        ) : file ? (
          <>
            {/* File info */}
            <div className="file-info-card">
              <span className="file-info-icon">{fileIcon(file.file_type)}</span>
              <div className="file-info-details">
                <div className="file-info-name">{file.file_name}</div>
                <div className="file-info-meta">
                  {formatSize(file.file_size)} · {file.file_type || 'neznámy typ'}
                </div>
              </div>
              <button
                className="regenerate-btn"
                onClick={generateSummary}
                disabled={loadingSummary}
              >
                {loadingSummary ? '⏳ Generujem...' : '🔄 Znova generovať'}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="summary-error">⚠️ {error}</div>
            )}

            {/* Summary content */}
            <div className="summary-card">
              <div className="summary-card-header">
                <h2>Zhrnutie dokumentu</h2>
                {summary && <span className="summary-badge">✨ Vygenerované Gemini AI</span>}
              </div>

              {loadingSummary ? (
                <div className="summary-generating">
                  <div className="loading-spinner large" />
                  <div>
                    <p>Gemini AI analyzuje dokument...</p>
                    <p className="generating-sub">Môže to trvať 10–30 sekúnd</p>
                  </div>
                </div>
              ) : summary ? (
                <div className="summary-text">
                  {summary.split('\n').map((line, i) => {
                    if (line.startsWith('## ') || line.startsWith('# ')) {
                      return <h3 key={i} className="summary-heading">{line.replace(/^#+\s/, '')}</h3>;
                    }
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={i} className="summary-bold">{line.replace(/\*\*/g, '')}</p>;
                    }
                    if (line.startsWith('- ') || line.startsWith('* ')) {
                      return <li key={i} className="summary-li">{line.replace(/^[-*]\s/, '')}</li>;
                    }
                    if (line.trim() === '') return <br key={i} />;
                    return <p key={i} className="summary-p">{line}</p>;
                  })}
                </div>
              ) : (
                <div className="summary-empty">Žiadne zhrnutie</div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
