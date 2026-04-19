import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import Navigation from '../components/Navigation';
import './AdminPage.css';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fileIcon(type) {
  if (type?.includes('pdf')) return '📄';
  if (type?.startsWith('image/')) return '🖼️';
  if (type?.includes('text')) return '📝';
  if (type?.includes('json') || type?.includes('javascript')) return '💻';
  return '📎';
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { token, getAuthHeaders } = useAuth();
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  /** Po úspešnom nahratí presmerovať rovno na AI test z dokumentu */
  const [openQuizAfterUpload, setOpenQuizAfterUpload] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchFiles();
  }, [token]);

  async function fetchFiles() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/files`, { headers: getAuthHeaders() });
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      const data = await res.json();
      if (data.success) setFiles(data.data);
      else setError(data.error?.message || 'Nepodarilo sa načítať súbory');
    } catch {
      setError('Chyba pri pripájaní na server');
    } finally {
      setLoading(false);
    }
  }

  function parseApiError(res, bodyText, fallback) {
    if (!bodyText?.trim()) {
      return res.ok ? fallback : `Chyba servera (${res.status})`;
    }
    try {
      const data = JSON.parse(bodyText);
      const msg = data.error?.message || data.message;
      if (typeof msg === 'string' && msg.length) return msg;
    } catch {
      /* nie JSON — napr. HTML z proxy */
    }
    return fallback;
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch(`${API_BASE_URL}/files`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError(
          'Server vrátil neplatnú odpoveď. Skontroluj, či backend beží a že VITE_API_URL v .env ukazuje na správny API (napr. http://localhost:3001).'
        );
        return;
      }
      if (!res.ok || !data.success) {
        const msg = parseApiError(res, text, 'Nahrávanie zlyhalo.');
        setError(msg.length > 400 ? 'Nahrávanie zlyhalo. Skontroluj konfiguráciu servera a Supabase.' : msg);
        return;
      }
      const uploaded = data.data;
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchFiles();
      if (openQuizAfterUpload && uploaded?.id) {
        navigate(`/admin/materials/${uploaded.id}/quiz`);
        setOpenQuizAfterUpload(false);
      } else if (uploaded) {
        setActiveFile(uploaded);
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(m.length > 400 ? 'Nepodarilo sa pripojiť k serveru alebo spracovať odpoveď.' : m);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file) {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/files/${file.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Vymazanie zlyhalo');
      setFiles(prev => prev.filter(f => f.id !== file.id));
      if (activeFile?.id === file.id) setActiveFile(null);
      setDeleteConfirm(null);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="admin-page">
      <Navigation />

      <div className="admin-hero">
        <div className="admin-hero-content">
          <h1>Admin Panel</h1>
          <p>
            Nahraj PDF alebo text, potom vygeneruj AI test z dokumentu (rovnaký formát ako testy v kurze) alebo
            AI zhrnutie.
          </p>
        </div>
      </div>

      <div className="admin-container">
        {error && (
          <div className="admin-error">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="admin-grid">
          {/* Upload panel */}
          <div className="admin-card upload-card">
            <h2 className="card-title">
              <span className="card-icon">⬆️</span>
              Nahrať súbor
            </h2>
            <p className="card-subtitle">PDF, TXT a ďalšie (max 20 MB). Z textu vie AI vytvoriť test s výberom odpovede.</p>

            <label className="upload-open-quiz">
              <input
                type="checkbox"
                checked={openQuizAfterUpload}
                onChange={(e) => setOpenQuizAfterUpload(e.target.checked)}
              />
              Po nahratí otvoriť stránku „Test z dokumentu“
            </label>

            <div
              className={`drop-zone ${selectedFile ? 'has-file' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
            >
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              />
              {selectedFile ? (
                <div className="drop-zone-file">
                  <span className="drop-icon">{fileIcon(selectedFile.type)}</span>
                  <span className="drop-name">{selectedFile.name}</span>
                  <span className="drop-size">{formatSize(selectedFile.size)}</span>
                </div>
              ) : (
                <div className="drop-zone-empty">
                  <span className="drop-icon">📂</span>
                  <span>Klikni alebo presuň súbor sem</span>
                </div>
              )}
            </div>

            <button
              className="upload-btn"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? (
                <><span className="spinner" />Nahrávam...</>
              ) : (
                <>⬆️ Nahrať súbor</>
              )}
            </button>
          </div>

          {/* Files list */}
          <div className="admin-card files-card">
            <div className="files-header">
              <div>
                <h2 className="card-title">
                  <span className="card-icon">📚</span>
                  Moje materiály
                </h2>
                <p className="card-subtitle">{files.length} súbor{files.length === 1 ? '' : files.length < 5 ? 'y' : 'ov'}</p>
              </div>
              <button className="refresh-btn" onClick={fetchFiles} title="Obnoviť">
                🔄
              </button>
            </div>

            {loading ? (
              <div className="files-loading">
                <div className="loading-spinner" />
                <span>Načítavam súbory...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="files-empty">
                <span>📭</span>
                <p>Žiadne súbory zatiaľ</p>
                <p className="files-empty-sub">Nahraj prvý súbor pomocou panelu vľavo</p>
              </div>
            ) : (
              <div className="files-list">
                {files.map(file => (
                  <div
                    key={file.id}
                    className={`file-item ${activeFile?.id === file.id ? 'active' : ''}`}
                    onClick={() => setActiveFile(activeFile?.id === file.id ? null : file)}
                  >
                    <span className="file-item-icon">{fileIcon(file.file_type)}</span>
                    <div className="file-item-info">
                      <span className="file-item-name">{file.file_name}</span>
                      <span className="file-item-meta">
                        {formatSize(file.file_size)} · {formatDate(file.uploaded_at)}
                      </span>
                    </div>
                    <span className="file-item-arrow">›</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active file actions */}
        {activeFile && (
          <div className="file-actions-bar">
            <div className="file-actions-info">
              <span className="file-actions-icon">{fileIcon(activeFile.file_type)}</span>
              <div>
                <div className="file-actions-name">{activeFile.file_name}</div>
                <div className="file-actions-meta">{formatSize(activeFile.file_size)} · {activeFile.file_type || 'neznámy typ'}</div>
              </div>
            </div>
            <div className="file-actions-btns">
              <button
                className="btn-summarize"
                onClick={() => navigate(`/admin/materials/${activeFile.id}`)}
              >
                🤖 AI Zhrnutie
              </button>
              <button
                className="btn-quiz"
                onClick={() => navigate(`/admin/materials/${activeFile.id}/quiz`)}
              >
                📝 Test z dokumentu
              </button>
              {deleteConfirm?.id === activeFile.id ? (
                <div className="delete-confirm">
                  <span>Naozaj zmazať?</span>
                  <button className="btn-confirm-yes" onClick={() => handleDelete(activeFile)}>Áno, zmazať</button>
                  <button className="btn-confirm-no" onClick={() => setDeleteConfirm(null)}>Zrušiť</button>
                </div>
              ) : (
                <button className="btn-delete" onClick={() => setDeleteConfirm(activeFile)}>
                  🗑️ Zmazať
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
