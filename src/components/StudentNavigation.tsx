import React from 'react';
import { Home, BookOpen, Award, Gift, LogOut, Shield, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import cashLogo from '../assets/images/cash_bundle_logo_1793025947722.jpg';

export type StudentNavTab = 'home' | 'learning' | 'certificate' | 'bonuses';

interface StudentNavigationProps {
  activeTab: StudentNavTab;
  onTabChange: (tab: StudentNavTab) => void;
  onOpenAdmin?: () => void;
  whatsappUrl?: string;
  xp?: number;
}

export function StudentNavigation({
  activeTab,
  onTabChange,
  onOpenAdmin,
  whatsappUrl,
  xp = 0,
}: StudentNavigationProps) {
  const { user, isAdmin, logout } = useAuth();

  // STRICT ORDER REQUIRED BY SPECIFICATION:
  // 1. Home
  // 2. My Learning
  // 3. Certificate
  // 4. Bonus Vault
  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'learning' as const, label: 'My Learning', icon: BookOpen },
    { id: 'certificate' as const, label: 'Certificate', icon: Award },
    { id: 'bonuses' as const, label: 'Bonus Vault', icon: Gift },
  ];

  return (
    <>
      {/* DESKTOP & TABLET TOP BAR */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark with Cash Bundle Picture */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-amber-500/50 shadow-md shrink-0 bg-slate-950 flex items-center justify-center">
              <img
                src={cashLogo}
                alt="Cash Bundle"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <button
              onClick={() => onTabChange('home')}
              className="text-left cursor-pointer transition-colors group"
            >
              <span className="text-sm sm:text-base font-bold tracking-tight text-white group-hover:text-amber-300 whitespace-nowrap block leading-tight">
                1 Million Naira Skill Challenge
              </span>
              <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block">
                by Elshaddai Idoga
              </span>
            </button>
          </div>

          {/* Zone 2: Student Nav Links (Strict order: Home, My Learning, Certificate, Bonus Vault) */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Student Details & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* XP Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-700/50 text-amber-300 text-xs font-medium tabular-nums">
              <span className="font-bold text-amber-400">{xp}</span>
              <span className="text-[10px] text-amber-300/80 uppercase">XP</span>
            </div>

            {/* WhatsApp Support Link if supplied */}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp Support Group"
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/60 text-xs font-medium transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Support Group</span>
              </a>
            )}

            {/* User Greeting & Sign Out */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <span className="hidden sm:inline text-xs text-slate-300 font-medium truncate max-w-[120px]">
                {user?.fullName?.split(' ')[0] || 'Student'}
              </span>
              <button
                onClick={logout}
                title="Sign out of portal"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE FIXED BOTTOM TAB BAR (Strict 4-tab contract in mandated order) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1 shadow-lg">
        <div className="grid grid-cols-4 items-center h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-all ${
                  isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
