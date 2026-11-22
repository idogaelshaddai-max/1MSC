import React, { useState, useEffect } from 'react';
import { Gift, Video, FileText, Download, ExternalLink, CheckSquare, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import type { BonusResource, BonusResourceType } from '../types/index.js';

const TYPE_CONFIG: Record<
  BonusResourceType,
  { label: string; icon: React.ElementType; colorClass: string }
> = {
  video: { label: 'Bonus Video', icon: Video, colorClass: 'bg-purple-100 text-purple-700' },
  template: { label: 'Resource Template', icon: FileText, colorClass: 'bg-blue-100 text-blue-700' },
  download: { label: 'Direct Download', icon: Download, colorClass: 'bg-emerald-100 text-emerald-700' },
  link: { label: 'External Link', icon: ExternalLink, colorClass: 'bg-amber-100 text-amber-700' },
  checklist: { label: 'Action Checklist', icon: CheckSquare, colorClass: 'bg-rose-100 text-rose-700' },
};

export function BonusVaultView() {
  const [bonuses, setBonuses] = useState<BonusResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchBonuses = async () => {
      try {
        setLoading(true);
        const data = await api.getStudentBonuses();
        setBonuses(data);
      } catch (err) {
        console.error('Failed to load bonus vault:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBonuses();
  }, []);

  const filteredBonuses =
    filter === 'all' ? bonuses : bonuses.filter((b) => b.resourceType === filter);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 animate-pulse space-y-4">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      {/* Title & Introduction */}
      <div className="text-center space-y-1">
        <span className="text-xs font-bold text-amber-600 uppercase tracking-widest flex items-center justify-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Exclusive Student Vault</span>
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          1M Challenge Bonus Vault
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          High-value blueprints, client acquisition templates, resource checklists, and bonus masterclasses provided by Elshaddai Idoga exclusively to challenge members.
        </p>
      </div>

      {/* Filter Tabs if multiple bonuses exist */}
      {bonuses.length > 0 && (
        <div className="flex items-center justify-center gap-1 p-1 bg-slate-100 rounded-xl max-w-md mx-auto overflow-x-auto">
          {['all', 'template', 'video', 'checklist', 'download', 'link'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize whitespace-nowrap cursor-pointer ${
                filter === t
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === 'all' ? 'All Assets' : t}
            </button>
          ))}
        </div>
      )}

      {/* Bonus Resource List or Empty State */}
      {filteredBonuses.length === 0 ? (
        <div className="max-w-md mx-auto p-8 bg-white border border-slate-200/90 rounded-2xl shadow-sm text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <Gift className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Bonus Vault Under Curation</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your instructor is curating exclusive templates, swipe files, and client-winning resources. As soon as materials are published, they will unlock here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredBonuses.map((bonus) => {
            const config = TYPE_CONFIG[bonus.resourceType] || TYPE_CONFIG.link;
            const Icon = config.icon;

            return (
              <div
                key={bonus.id}
                className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:border-amber-400/60 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${config.colorClass}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{config.label}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                      {bonus.title}
                    </h3>
                    {bonus.description && (
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {bonus.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Available to all students</span>
                  <a
                    href={bonus.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-semibold text-xs transition-colors shadow-sm"
                  >
                    <span>Access Resource</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
