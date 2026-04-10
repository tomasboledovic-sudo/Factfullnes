import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { fetchFiles(); }, []);

  async function fetchFiles() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/files`);
      const data = await res.json();
      if (data.success) setFiles(data.data);
      else setError(data.error?.message || 'Nepodarilo sa načítať súbory');
    } catch {
      setError('Chyba pri pripájaní na server');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch(`${API_BASE_URL}/files`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Upload zlyhal');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchFiles();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file) {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/files/${file.id}`, { method: 'DELETE' });
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
          <p>Spravuj učebné materiály — nahrávaj súbory a generuj AI zhrnutia</p>
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
            <p className="card-subtitle">PDF, TXT, kód a ďalšie formáty (max 20 MB)</p>

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
                  Všetky materiály
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
