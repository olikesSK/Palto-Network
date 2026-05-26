import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { Folder, File, FileText, FileCode, ChevronRight, Plus, FolderPlus, Save, Trash2, Edit3, X, Check } from 'lucide-react';
import api from '../../api/client';
import { toast } from '../ui/Toaster';

interface FileEntry {
  id: string;
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  updated_at: string;
}

interface FileManagerProps {
  serverId: string;
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    json: 'json', properties: 'properties', yml: 'yaml', yaml: 'yaml',
    cfg: 'ini', log: 'plaintext', sh: 'shell', js: 'javascript',
    ts: 'typescript', py: 'python', xml: 'xml', txt: 'plaintext',
    conf: 'ini', ini: 'ini', toml: 'toml',
  };
  return map[ext || ''] || 'plaintext';
}

function FileIcon({ name, isDir }: { name: string; isDir: boolean }) {
  if (isDir) return <Folder size={16} style={{ color: '#f59e0b' }} />;
  const ext = name.split('.').pop()?.toLowerCase();
  if (['json', 'js', 'ts', 'py', 'sh'].includes(ext || '')) return <FileCode size={16} style={{ color: '#38bdf8' }} />;
  if (['log', 'txt'].includes(ext || '')) return <FileText size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />;
  return <File size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FileManager({ serverId }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [content, setContent] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/servers/${serverId}/files`, { params: { path } });
      setFiles(res.data);
    } catch {
      toast.error('Nepodařilo se načíst soubory');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { loadFiles(currentPath); }, [currentPath, loadFiles]);

  const openFile = async (file: FileEntry) => {
    if (file.is_dir) {
      setCurrentPath(file.path.endsWith('/') ? file.path : file.path + '/');
      setSelectedFile(null);
      return;
    }
    try {
      const res = await api.get(`/servers/${serverId}/files/content`, { params: { path: file.path } });
      setContent(res.data.content);
      setEditorContent(res.data.content);
      setSelectedFile(file);
    } catch {
      toast.error('Nepodařilo se načíst obsah souboru');
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await api.put(`/servers/${serverId}/files/content`, { path: selectedFile.path, content: editorContent });
      setContent(editorContent);
      toast.success('Soubor uložen');
      loadFiles(currentPath);
    } catch {
      toast.error('Nepodařilo se uložit soubor');
    } finally {
      setSaving(false);
    }
  };

  const createFile = async () => {
    if (!newName.trim()) return;
    const filePath = currentPath === '/' ? `/${newName}` : `${currentPath}${newName}`;
    try {
      await api.post(`/servers/${serverId}/files/create`, { path: filePath, content: '' });
      toast.success('Soubor vytvořen');
      setShowNewFile(false);
      setNewName('');
      loadFiles(currentPath);
    } catch {
      toast.error('Nepodařilo se vytvořit soubor');
    }
  };

  const createFolder = async () => {
    if (!newName.trim()) return;
    const dirPath = currentPath === '/' ? `/${newName}/` : `${currentPath}${newName}/`;
    try {
      await api.post(`/servers/${serverId}/files/mkdir`, { path: dirPath });
      toast.success('Složka vytvořena');
      setShowNewFolder(false);
      setNewName('');
      loadFiles(currentPath);
    } catch {
      toast.error('Nepodařilo se vytvořit složku');
    }
  };

  const deleteFile = async (file: FileEntry) => {
    if (!confirm(`Smazat "${file.name}"?`)) return;
    try {
      await api.delete(`/servers/${serverId}/files`, { data: { path: file.path } });
      toast.success('Smazáno');
      if (selectedFile?.path === file.path) setSelectedFile(null);
      loadFiles(currentPath);
    } catch {
      toast.error('Nepodařilo se smazat');
    }
  };

  const renameFile = async () => {
    if (!renaming || !renameValue.trim()) return;
    const dir = renaming.path.substring(0, renaming.path.lastIndexOf('/') + 1);
    const newPath = dir + renameValue + (renaming.is_dir ? '/' : '');
    try {
      await api.post(`/servers/${serverId}/files/rename`, { oldPath: renaming.path, newPath });
      toast.success('Přejmenováno');
      setRenaming(null);
      loadFiles(currentPath);
    } catch {
      toast.error('Nepodařilo se přejmenovat');
    }
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  const sortedFiles = [...files].sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex h-[600px] gap-0">
      {/* Left: File tree */}
      <div className="w-72 flex flex-col" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-3 py-2.5 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
          <button
            className="text-xs hover:text-white transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onClick={() => { setCurrentPath('/'); setSelectedFile(null); }}
          >
            ~
          </button>
          {breadcrumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={10} style={{ color: 'rgba(255,255,255,0.3)' }} />
              <button
                className="text-xs hover:text-white transition-colors"
                style={{ color: i === breadcrumbs.length - 1 ? 'white' : 'rgba(255,255,255,0.5)' }}
                onClick={() => {
                  const path = '/' + breadcrumbs.slice(0, i + 1).join('/') + '/';
                  setCurrentPath(path);
                  setSelectedFile(null);
                }}
              >
                {part}
              </button>
            </span>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex gap-1 p-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => { setShowNewFile(true); setShowNewFolder(false); setNewName(''); }}
            className="glass-btn flex items-center gap-1 px-2 py-1.5 text-xs"
            title="Nový soubor"
          >
            <Plus size={12} /> Soubor
          </button>
          <button
            onClick={() => { setShowNewFolder(true); setShowNewFile(false); setNewName(''); }}
            className="glass-btn flex items-center gap-1 px-2 py-1.5 text-xs"
            title="Nová složka"
          >
            <FolderPlus size={12} /> Složka
          </button>
        </div>

        {/* New file/folder input */}
        <AnimatePresence>
          {(showNewFile || showNewFolder) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-2 py-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex gap-1">
                <input
                  autoFocus
                  className="glass-input flex-1 px-2 py-1.5 text-xs"
                  placeholder={showNewFile ? 'nome-arquivo.txt' : 'nova-pasta'}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') showNewFile ? createFile() : createFolder();
                    if (e.key === 'Escape') { setShowNewFile(false); setShowNewFolder(false); }
                  }}
                />
                <button className="glass-btn p-1.5" onClick={showNewFile ? createFile : createFolder}>
                  <Check size={12} style={{ color: '#22c55e' }} />
                </button>
                <button className="glass-btn p-1.5" onClick={() => { setShowNewFile(false); setShowNewFolder(false); }}>
                  <X size={12} style={{ color: '#f87171' }} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : sortedFiles.length === 0 ? (
            <div className="py-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Prázdná složka
            </div>
          ) : (
            sortedFiles.map(file => (
              <div
                key={file.id}
                className="group flex items-center gap-2 px-3 py-2 cursor-pointer transition-all"
                style={{
                  background: selectedFile?.path === file.path ? 'rgba(124,58,237,0.15)' : 'transparent',
                  borderLeft: selectedFile?.path === file.path ? '2px solid #7c3aed' : '2px solid transparent',
                }}
                onClick={() => {
                  if (renaming?.path === file.path) return;
                  openFile(file);
                }}
              >
                <FileIcon name={file.name} isDir={file.is_dir} />
                {renaming?.path === file.path ? (
                  <div className="flex-1 flex gap-1" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      className="glass-input flex-1 px-1.5 py-0.5 text-xs"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameFile();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                    />
                    <button onClick={renameFile}><Check size={11} style={{ color: '#22c55e' }} /></button>
                    <button onClick={() => setRenaming(null)}><X size={11} style={{ color: '#f87171' }} /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-xs truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {file.name}
                    </span>
                    {!file.is_dir && (
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {formatSize(file.size)}
                      </span>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-0.5 hover:text-white transition-colors"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                        onClick={e => {
                          e.stopPropagation();
                          setRenaming(file);
                          setRenameValue(file.name);
                        }}
                        title="Přejmenovat"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        className="p-0.5 transition-colors"
                        style={{ color: 'rgba(239,68,68,0.5)' }}
                        onClick={e => { e.stopPropagation(); deleteFile(file); }}
                        title="Smazat"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
              <div className="flex items-center gap-2">
                <FileIcon name={selectedFile.name} isDir={false} />
                <span className="text-sm text-white">{selectedFile.name}</span>
                {editorContent !== content && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                    Neuloženo
                  </span>
                )}
              </div>
              <button
                onClick={saveFile}
                disabled={saving}
                className="glass-btn glass-btn-primary flex items-center gap-2 px-3 py-1.5 text-xs disabled:opacity-40"
              >
                <Save size={13} />
                {saving ? 'Ukládání...' : 'Uložit (Ctrl+S)'}
              </button>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                language={getLanguage(selectedFile.name)}
                value={editorContent}
                onChange={v => setEditorContent(v || '')}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  padding: { top: 12, bottom: 12 },
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
                onMount={(_editor, monaco) => {
                  monaco.editor.defineTheme('wizz-dark', {
                    base: 'vs-dark',
                    inherit: true,
                    rules: [],
                    colors: {
                      'editor.background': '#0a0520',
                      'editor.lineHighlightBackground': '#ffffff08',
                      'editorLineNumber.foreground': '#ffffff20',
                    },
                  });
                  monaco.editor.setTheme('wizz-dark');
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <FileText size={48} />
            <p className="text-sm">Vyberte soubor pro úpravu</p>
          </div>
        )}
      </div>
    </div>
  );
}
