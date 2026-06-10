import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { axiosClient } from '../../shared/api/axiosClient';

/**
 * F2 (Phase 6) — Global Search Modal kích hoạt bằng Ctrl+K.
 *  - Debounce 200ms gọi /api/v1/search?q=...
 *  - 3 nhóm kết quả: Documents · Projects · Users
 *  - Keyboard nav: ↑ ↓ chọn, Enter mở, Esc đóng
 *  - Highlight matched substring trong title/name
 *  - Score-based ranking (pg_trgm similarity)
 *
 * Không cần Service mới — tận dụng GIN trigram index có sẵn.
 */

interface DocumentHit {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  status: string;
  securityLevel: string;
  score: number;
}
interface ProjectHit {
  id: string;
  name: string;
  status: string;
  score: number;
}
interface UserHit {
  id: string;
  fullName: string;
  email: string;
  title: string | null;
  department: string | null;
  score: number;
}
interface SearchResponse {
  query: string;
  documents: DocumentHit[];
  projects: ProjectHit[];
  users: UserHit[];
  total: number;
}

export function GlobalSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useRef<number | undefined>(undefined);

  // Reset state khi mở
  useEffect(() => {
    if (open) {
      setQ('');
      setDebouncedQ('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounce 200ms
  useEffect(() => {
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setDebouncedQ(q), 200);
    return () => window.clearTimeout(t.current);
  }, [q]);

  const search = useQuery<SearchResponse>({
    queryKey: ['global-search', debouncedQ],
    queryFn: async () =>
      (await axiosClient.get(`/search?q=${encodeURIComponent(debouncedQ)}&limit=6`)).data,
    enabled: debouncedQ.trim().length >= 2,
    placeholderData: keepPreviousData,
  });

  // Flatten hits cho keyboard nav
  const flatHits: Array<{ type: 'document' | 'project' | 'user'; data: any }> = [];
  if (search.data) {
    search.data.documents.forEach((d) => flatHits.push({ type: 'document', data: d }));
    search.data.projects.forEach((p) => flatHits.push({ type: 'project', data: p }));
    search.data.users.forEach((u) => flatHits.push({ type: 'user', data: u }));
  }

  // Reset activeIdx khi results đổi
  useEffect(() => {
    setActiveIdx(0);
  }, [debouncedQ, search.data]);

  const openHit = (hit: { type: string; data: any }) => {
    onClose();
    if (hit.type === 'document') navigate(`/documents/${hit.data.id}/detail`);
    else if (hit.type === 'project') navigate(`/projects/${hit.data.id}/folders/root`);
    else if (hit.type === 'user') navigate(`/users/${hit.data.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flatHits.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && flatHits[activeIdx]) {
      e.preventDefault();
      openHit(flatHits[activeIdx]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-[10vh] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="px-5 py-3 border-b flex items-center gap-3">
          <span className="text-gray-400 text-xl">🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Tìm tài liệu, dự án, nhân sự... (Ctrl+K)"
            className="flex-1 text-base outline-none"
          />
          <kbd className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 font-mono">Esc</kbd>
        </div>

        {/* Hint khi chưa search */}
        {debouncedQ.trim().length < 2 && (
          <div className="p-10 text-center text-sm text-gray-400">
            <div className="text-5xl mb-2">⌨️</div>
            <p>Gõ ít nhất 2 ký tự để bắt đầu tìm kiếm</p>
            <p className="text-xs mt-2">
              Sử dụng <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">↑ ↓</kbd> điều
              hướng, <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> mở,
              <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono ml-1">Esc</kbd> đóng.
            </p>
          </div>
        )}

        {search.isLoading && debouncedQ.trim().length >= 2 && (
          <div className="p-6 text-center text-sm text-gray-500">Đang tìm...</div>
        )}

        {search.data && search.data.total === 0 && debouncedQ.trim().length >= 2 && (
          <div className="p-10 text-center text-sm text-gray-500">
            <div className="text-4xl mb-2">🤷</div>
            Không tìm thấy kết quả nào cho "<b>{debouncedQ}</b>".
          </div>
        )}

        {search.data && search.data.total > 0 && (
          <div className="overflow-y-auto">
            {/* Documents */}
            {search.data.documents.length > 0 && (
              <section>
                <h3 className="px-5 pt-3 pb-1 text-xs font-bold uppercase text-gray-500">
                  Tài liệu ({search.data.documents.length})
                </h3>
                {search.data.documents.map((d, i) => {
                  const idx = i;
                  const active = activeIdx === idx;
                  return (
                    <button
                      key={d.id}
                      onClick={() => openHit({ type: 'document', data: d })}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full px-5 py-2.5 flex items-center gap-3 text-left transition-colors ${
                        active ? 'bg-viettel-red/5 border-l-4 border-viettel-red' : ''
                      }`}
                    >
                      <span className="text-xl">📄</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          <HighlightMatch text={d.title} query={debouncedQ} />
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          📁 {d.projectName} · {d.status} · {d.securityLevel}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {(d.score * 100).toFixed(0)}%
                      </span>
                    </button>
                  );
                })}
              </section>
            )}

            {/* Projects */}
            {search.data.projects.length > 0 && (
              <section>
                <h3 className="px-5 pt-3 pb-1 text-xs font-bold uppercase text-gray-500 border-t">
                  Dự án ({search.data.projects.length})
                </h3>
                {search.data.projects.map((p, i) => {
                  const idx = search.data!.documents.length + i;
                  const active = activeIdx === idx;
                  return (
                    <button
                      key={p.id}
                      onClick={() => openHit({ type: 'project', data: p })}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full px-5 py-2.5 flex items-center gap-3 text-left transition-colors ${
                        active ? 'bg-viettel-red/5 border-l-4 border-viettel-red' : ''
                      }`}
                    >
                      <span className="text-xl">📁</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          <HighlightMatch text={p.name} query={debouncedQ} />
                        </div>
                        <div className="text-xs text-gray-500">Status: {p.status}</div>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {(p.score * 100).toFixed(0)}%
                      </span>
                    </button>
                  );
                })}
              </section>
            )}

            {/* Users */}
            {search.data.users.length > 0 && (
              <section>
                <h3 className="px-5 pt-3 pb-1 text-xs font-bold uppercase text-gray-500 border-t">
                  Nhân sự ({search.data.users.length})
                </h3>
                {search.data.users.map((u, i) => {
                  const idx =
                    search.data!.documents.length + search.data!.projects.length + i;
                  const active = activeIdx === idx;
                  return (
                    <button
                      key={u.id}
                      onClick={() => openHit({ type: 'user', data: u })}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full px-5 py-2.5 flex items-center gap-3 text-left transition-colors ${
                        active ? 'bg-viettel-red/5 border-l-4 border-viettel-red' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-viettel-red text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          <HighlightMatch text={u.fullName} query={debouncedQ} />
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {u.email}
                          {u.title && ` · ${u.title}`}
                          {u.department && ` · ${u.department}`}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {(u.score * 100).toFixed(0)}%
                      </span>
                    </button>
                  );
                })}
              </section>
            )}
          </div>
        )}

        {/* Footer hint */}
        <div className="border-t px-5 py-2 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <span>
            <kbd className="bg-white border px-1.5 py-0.5 rounded font-mono">↑ ↓</kbd> navigate{' '}
            <kbd className="bg-white border px-1.5 py-0.5 rounded font-mono ml-2">Enter</kbd> open
          </span>
          <span className="text-viettel-red">pg_trgm GIN index</span>
        </div>
      </div>
    </div>
  );
}

/** Highlight matched substring (case-insensitive). */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 font-bold px-0.5 rounded">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
