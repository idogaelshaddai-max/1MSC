import React, { useState, useEffect } from 'react';
import { Award, Lock, CheckCircle2, AlertCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { api } from '../lib/api.js';
import type { CertificateStatus } from '../types/index.js';
import certImg from '../assets/images/certificate_gold_seal_1793022390696.jpg';

interface CertificateViewProps {
  onNavigateToLesson: (lessonId: string) => void;
}

export function CertificateView({ onNavigateToLesson }: CertificateViewProps) {
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await api.getCertificateStatus();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to verify certificate eligibility');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleOpenCertificateRequest = () => {
    if (!status || !status.eligible) return;

    if (status.certificateRequestUrl && status.certificateRequestUrl.trim()) {
      window.open(status.certificateRequestUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 animate-pulse space-y-6">
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  const {
    eligible = false,
    totalRequired = 0,
    completedRequired = 0,
    missingLessons = [],
    certificateRequestUrl = '',
    message = '',
  } = status || {};

  const percent = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      {/* Top Banner / Framing */}
      <div className="text-center space-y-1">
        <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">
          Executive Accreditation · Course by Elshaddai Idoga
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          1 Million Naira Skill Challenge Certificate
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          Awarded upon verified completion of all foundational practical milestones.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Certificate Showcase Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
          {/* Certificate Mockup Frame */}
          <div className="relative bg-slate-900 min-h-[260px] sm:min-h-[320px] flex items-center justify-center p-4">
            <img
              src={certImg}
              alt="Official Certificate Preview"
              className="w-full h-full max-h-[300px] object-cover rounded-xl shadow-lg border border-amber-500/30"
              referrerPolicy="no-referrer"
            />
            {/* Status overlay badge */}
            <div className="absolute top-4 right-4">
              {eligible ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs shadow-md">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Eligible</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 font-semibold text-xs shadow-md backdrop-blur-sm">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Locked</span>
                </div>
              )}
            </div>
          </div>

          {/* Verification & Request Details */}
          <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Eligibility Requirement
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {eligible ? 'Accreditation Criteria Fulfilled' : 'Mandatory Course Milestones'}
                </h3>
              </div>

              {/* Progress metric */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span>Required Lessons Progress</span>
                  <span className="tabular-nums">
                    {completedRequired} of {totalRequired} ({percent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      eligible
                        ? 'bg-emerald-600'
                        : 'bg-gradient-to-r from-blue-700 to-amber-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Server evaluation message */}
              <div
                className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                  eligible
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border border-slate-200 text-slate-700'
                }`}
              >
                {message}
              </div>

              {/* Discipline note: XP and badges do not affect certificate */}
              <p className="text-[11px] text-slate-500 italic">
                * Note: In accordance with academic integrity guidelines, XP points and badges do not determine certification. Only verified completion of required curriculum lessons qualifies you.
              </p>
            </div>

            {/* ACTION BUTTON AREA */}
            <div className="pt-4 border-t border-slate-100">
              {eligible ? (
                certificateRequestUrl && certificateRequestUrl.trim() ? (
                  <button
                    onClick={handleOpenCertificateRequest}
                    className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Request Official Certificate</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs font-medium text-center">
                    Certificate request link will be added soon by the instructor.
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  <button
                    disabled
                    className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Certificate Locked</span>
                  </button>
                  <p className="text-[11px] text-slate-400 text-center">
                    Complete all remaining required lessons below to unlock your certificate.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* REMAINING REQUIRED LESSONS LIST (If locked) */}
      {!eligible && missingLessons.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Remaining Required Lessons</h3>
              <p className="text-xs text-slate-500">
                You must complete these {missingLessons.length} specific lessons to qualify.
              </p>
            </div>
            <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded tabular-nums">
              {missingLessons.length} Pending
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {missingLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="py-3 flex items-center justify-between gap-4 text-xs"
              >
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {lesson.moduleTitle}
                  </span>
                  <p className="font-bold text-slate-900 mt-0.5">{lesson.title}</p>
                </div>
                <button
                  onClick={() => onNavigateToLesson(lesson.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Go to Lesson</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
