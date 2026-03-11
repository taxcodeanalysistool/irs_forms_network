// src/components/DocumentModal.tsx
import { useState, useEffect } from 'react';
import { fetchNodeDetails, fetchDocumentText } from '../api';

interface Props {
  docId: string;
  highlightTerm?: string | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

const TEXT_NODE_TYPES = ['index', 'section', 'regulation'];

const METRIC_PAIRS = [
  { moneyKey: 'total_amount',        countKey: 'total_num_forms',     moneyLabel: 'Total Amt',      countLabel: 'Total Forms' },
  { moneyKey: 'amount_per_form',     countKey: 'num_lines',           moneyLabel: 'Amt/Form',       countLabel: '# Lines'     },
  { moneyKey: 'amount',              countKey: 'num_forms',           moneyLabel: 'Amount',         countLabel: '# Forms'     },
  { moneyKey: 'ind_total_amount',    countKey: 'ind_total_num_forms', moneyLabel: 'Ind. Amt',       countLabel: 'Ind. Forms'  },
  { moneyKey: 'ind_amount_per_form', countKey: 'ind_num_lines',       moneyLabel: 'Ind. Amt/Form',  countLabel: 'Ind. Lines'  },
  { moneyKey: 'corp_total_amount',   countKey: 'corp_total_num_forms',moneyLabel: 'Corp. Amt',      countLabel: 'Corp. Forms' },
  { moneyKey: 'corp_amount_per_form',countKey: 'corp_num_lines',      moneyLabel: 'Corp. Amt/Form', countLabel: 'Corp. Lines' },
] as const;

const COMMON_WORDS = new Set([
  'the','and','or','to','from','in','on','at','by','for','with','about','as',
  'into','through','during','before','after','above','below','between','under',
  'since','without','within','of','off','out','over','up','down','near','along',
  'among','across','behind','beyond','plus','except','but','per','via','upon','against',
]);

function formatMoney(val: number) {
  return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function highlightText(text: string, term: string | null): JSX.Element[] {
  if (!term || !text) return [<span key="0">{text}</span>];
  try {
    const patterns: string[] = [];
    const primaryWords = new Set<string>();

    patterns.push(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    term.split(/\s+/).forEach(word => {
      if (word.length >= 3 && !COMMON_WORDS.has(word.toLowerCase())) {
        primaryWords.add(word.toLowerCase());
        patterns.push(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      }
    });

    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
    return text.split(regex).map((part, i) => {
      const lower = part.toLowerCase();
      if (lower === term.toLowerCase() || primaryWords.has(lower)) {
        return <mark key={i} className="bg-yellow-400 text-black px-1 rounded">{part}</mark>;
      }
      return <span key={i}>{part}</span>;
    });
  } catch {
    return [<span key="0">{text}</span>];
  }
}

const nodeTypeColors: Record<string, string> = {
  form: '#88BACE', line: '#A67EB3', index: '#7B6FC4', regulation: '#6BA3B5',
};

export default function DocumentModal({
  docId, highlightTerm, onClose, onNext, onPrev, currentIndex, totalCount
}: Props) {
  const [details, setDetails] = useState<any>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDetails(null);
    setText('');

    Promise.all([
      fetchNodeDetails(docId),
      fetchDocumentText(docId),
    ]).then(([det, textData]) => {
      if (!active) return;
      setDetails(det);
      setText(textData?.text || '');
    }).catch(console.error)
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [docId]);

  const isTextNode = TEXT_NODE_TYPES.includes(details?.node_type);
  const hasText = text && text.trim() !== '' && text !== 'No text available for this node.';

  const metricPairs = details
    ? METRIC_PAIRS.filter(p => details[p.moneyKey] !== undefined || details[p.countKey] !== undefined)
    : [];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col relative border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-start gap-6 flex-shrink-0">

          {/* Left: title + hierarchy */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h2 className="text-2xl font-semibold text-blue-400">
                {details?.display_label || details?.name || docId}
              </h2>
              {details?.node_type && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full border border-gray-600 bg-gray-900"
                  style={{ color: nodeTypeColors[details.node_type] ?? '#9ca3af' }}
                >
                  {details.node_type}
                </span>
              )}
              {details?.category && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full border border-gray-600 bg-gray-900"
                  style={{ color: details.category === 'individual' ? '#60a5fa' : '#c084fc' }}
                >
                  {details.category === 'individual' ? '👤 Individual' : '🏢 Corporation'}
                </span>
              )}
            </div>

            {/* Stacked monospace hierarchy */}
            {details && (details.title || details.section || details.full_name) && (
              <div className="space-y-1 text-sm text-gray-300 font-mono">
                {details.title && (
                  <div><span className="text-gray-500">Title: </span>{details.title}</div>
                )}
                {details.subtitle && (
                  <div><span className="text-gray-500">Subtitle: </span>{details.subtitle}</div>
                )}
                {details.part && (
                  <div><span className="text-gray-500">Part: </span>{details.part}</div>
                )}
                {details.chapter && (
                  <div><span className="text-gray-500">Chapter: </span>{details.chapter}</div>
                )}
                {details.subchapter && (
                  <div><span className="text-gray-500">Subchapter: </span>{details.subchapter}</div>
                )}
                {details.section && (
                  <div><span className="text-gray-500">Section: </span>§{details.section}. {details.index_heading || ''}</div>
                )}
                {details.subsection && (
                  <div><span className="text-gray-500">Subsection: </span>({details.subsection})</div>
                )}
                {details.full_name && !details.title && !details.section && (
                  <div className="text-gray-400">{details.full_name}</div>
                )}
              </div>
            )}
          </div>

          {/* Right: close + financial grid */}
          <div className="flex flex-col items-end gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl leading-none transition-colors"
            >
              ✕
            </button>

            {metricPairs.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5" style={{ minWidth: '220px' }}>
                {metricPairs.map(pair => (
                  <div key={pair.moneyKey} className="bg-gray-900 border border-gray-700 rounded px-2.5 py-1.5">
                    <div className="text-xs text-gray-500 leading-tight">{pair.moneyLabel}</div>
                    <div className="font-mono font-semibold text-xs leading-tight text-white">
                      {details[pair.moneyKey] !== undefined
                        ? formatMoney(details[pair.moneyKey] ?? 0)
                        : '—'}
                    </div>
                    <div className="text-xs text-gray-500 leading-tight mt-1">{pair.countLabel}</div>
                    <div className="font-mono font-semibold text-xs leading-tight text-white">
                      {details[pair.countKey] !== undefined
                        ? Number(details[pair.countKey] ?? 0).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {details?.definition && !isTextNode && (
              <div className="bg-blue-900/20 border border-blue-700/30 rounded p-2 text-xs text-gray-300 max-w-xs">
                <div className="text-blue-400 font-semibold mb-1">Definition</div>
                {details.definition}
              </div>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400">Loading...</div>
            </div>
          ) : !hasText && !details?.definition ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400 text-center">
                <p className="text-lg">
                  {!isTextNode
                    ? 'No text available for this node.'
                    : 'Full text for this node is not available.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none">
              {details?.definition && isTextNode && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded text-sm text-gray-300">
                  <div className="text-blue-400 font-semibold text-xs uppercase tracking-wide mb-1">Definition</div>
                  {highlightText(details.definition, highlightTerm ?? null)}
                </div>
              )}
              {hasText && (
                <div className="whitespace-pre-wrap text-gray-300 leading-relaxed font-mono text-sm">
                  {highlightText(text, highlightTerm ?? null)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-4 border-t border-gray-700 flex justify-between items-center flex-shrink-0">
          <div className="text-sm text-gray-500 flex gap-4">
            {highlightTerm && (
              <span className="inline-block bg-yellow-400 text-black px-2 py-0.5 rounded text-xs">
                {highlightTerm}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(onPrev || onNext) && (
              <div className="flex items-center gap-2 mr-4">
                <button
                  onClick={e => { e.stopPropagation(); onPrev?.(); }}
                  disabled={!onPrev}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                >
                  ← Prev
                </button>
                {currentIndex !== undefined && totalCount !== undefined && (
                  <span className="text-xs text-gray-400 min-w-[60px] text-center">
                    {currentIndex + 1} / {totalCount}
                  </span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onNext?.(); }}
                  disabled={!onNext}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
            <button
              onClick={e => { e.stopPropagation(); onClose(); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
