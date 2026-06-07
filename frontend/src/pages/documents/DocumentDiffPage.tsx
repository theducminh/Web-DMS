import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { axiosClient } from '../../shared/api/axiosClient';

interface Delta {
  type: 'unchanged' | 'added' | 'removed';
  count?: number;
  value: string;
}
interface DiffResponse {
  documentId: string;
  meta: { v1: { versionNo: number; author: string }; v2: { versionNo: number; author: string } };
  originalUrls: { v1Url: string; v2Url: string };
  diffAvailable: boolean;
  statistics: { additions: number; deletions: number };
  diffDeltas: Delta[];
}

type Mode = 'original' | 'diff';

export function DocumentDiffPage() {
  const [params] = useSearchParams();
  const [docId, setDocId] = useState(params.get('docId') ?? '');
  const [v1, setV1] = useState<string>(params.get('v1') ?? '1');
  const [v2, setV2] = useState<string>(params.get('v2') ?? '2');
  const [data, setData] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('diff');

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setData(null);
    if (!docId) {
      setError('Nhập docId.');
      return;
    }
    setLoading(true);
    try {
      const res = await axiosClient.get<DiffResponse>(
        `/documents/${docId}/diff?v1=${v1}&v2=${v2}`,
      );
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không tải được diff.');
    } finally {
      setLoading(false);
    }
  };

  const swap = () => {
    const a = v1;
    setV1(v2);
    setV2(a);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hybrid Visual Diff Engine</h1>

      <form onSubmit={run} className="bg-white rounded shadow p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[300px]">
          <label className="block text-xs text-gray-500 mb-1">Document ID</label>
          <input
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            placeholder="uuid của tài liệu"
            className="w-full border rounded px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">v1</label>
          <input
            type="number"
            value={v1}
            onChange={(e) => setV1(e.target.value)}
            className="w-20 border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">v2</label>
          <input
            type="number"
            value={v2}
            onChange={(e) => setV2(e.target.value)}
            className="w-20 border rounded px-3 py-2"
          />
        </div>
        <button
          type="button"
          onClick={swap}
          title="Hoán đổi v1/v2"
          className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
        >
          ⇄
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bg-viettel-red text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Đang so sánh...' : 'So sánh'}
        </button>
      </form>

      {error && (
        <div className="text-danger bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</div>
      )}

      {data && (
        <>
          {/* Toolbar: meta + toggle mode + stats */}
          <div className="bg-white rounded shadow p-4 flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs text-gray-500">v{data.meta.v1.versionNo}</div>
              <div className="text-sm">{data.meta.v1.author}</div>
            </div>
            <div className="text-2xl text-gray-400">→</div>
            <div>
              <div className="text-xs text-gray-500">v{data.meta.v2.versionNo}</div>
              <div className="text-sm">{data.meta.v2.author}</div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <ToggleBtn active={mode === 'original'} onClick={() => setMode('original')}>
                Xem bản gốc
              </ToggleBtn>
              <ToggleBtn active={mode === 'diff'} onClick={() => setMode('diff')}>
                Xem thay đổi
              </ToggleBtn>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-green-600 text-sm">+ {data.statistics.additions}</span>
              <span className="text-red-600 text-sm">− {data.statistics.deletions}</span>
              {!data.diffAvailable && mode === 'diff' && (
                <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                  Chưa có raw_text — text diff không khả dụng
                </span>
              )}
            </div>
          </div>

          {mode === 'original' ? (
            <div className="bg-white rounded shadow overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                <OriginalPane url={data.originalUrls.v1Url} title={`Bản v${data.meta.v1.versionNo}`} />
                <OriginalPane url={data.originalUrls.v2Url} title={`Bản v${data.meta.v2.versionNo}`} />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded shadow overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                <DeltaColumn deltas={data.diffDeltas} side="left" />
                <DeltaColumn deltas={data.diffDeltas} side="right" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm border transition-colors ${
        active ? 'bg-viettel-red text-white border-viettel-red' : 'bg-white hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function OriginalPane({ url, title }: { url: string; title: string }) {
  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 bg-gray-50 border-b text-xs uppercase text-gray-500 flex items-center justify-between">
        <span>{title}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-viettel-red hover:underline normal-case"
        >
          Mở/tải ↗
        </a>
      </div>
      <iframe
        src={url}
        title={title}
        className="w-full h-[60vh] bg-white"
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
}

function DeltaColumn({ deltas, side }: { deltas: Delta[]; side: 'left' | 'right' }) {
  return (
    <div className="p-3 font-mono text-xs whitespace-pre-wrap break-all">
      <div className="text-gray-400 text-xs mb-2 uppercase">
        {side === 'left' ? 'Bản cũ (v1)' : 'Bản mới (v2)'}
      </div>
      {deltas.map((d, i) => {
        if (d.type === 'unchanged') {
          return (
            <div key={i} className="text-gray-500 py-0.5">
              {d.value || `... (${d.count} dòng không đổi)`}
            </div>
          );
        }
        if (d.type === 'removed') {
          return side === 'left' ? (
            <div key={i} className="bg-red-50 text-red-700 py-0.5 border-l-2 border-red-400 pl-2">
              − {d.value}
            </div>
          ) : (
            <div key={i} className="py-0.5">&nbsp;</div>
          );
        }
        return side === 'right' ? (
          <div key={i} className="bg-green-50 text-green-700 py-0.5 border-l-2 border-green-400 pl-2">
            + {d.value}
          </div>
        ) : (
          <div key={i} className="py-0.5">&nbsp;</div>
        );
      })}
    </div>
  );
}
