'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  BookOpen,
  X,
  Zap,
  Sparkles,
  Eye,
  Shield,
  Heart,
  Swords,
  Repeat2,
  Snowflake,
  RotateCcw,
  Star,
  Flame,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface GameGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'board' | 'cards' | 'rules';
}

export function GameGuideModal({
  isOpen,
  onClose,
  defaultTab = 'board',
}: GameGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'board' | 'cards' | 'rules'>(defaultTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/98 via-slate-950/98 to-slate-900/98 text-left shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(6,182,212,0.2)] ring-1 ring-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top luminous accent beam */}
        <span className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4 sm:px-6 sm:py-5 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.35)] shrink-0">
              <BookOpen className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="guide-modal-title" className="text-lg sm:text-xl font-black tracking-tight text-white">
                  คู่มือการเล่น WordX
                </h2>
                <span className="rounded-full border border-cyan-500/40 bg-cyan-950/60 px-2 py-0.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                  Game Guide
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                สัญลักษณ์บนกระดาน การ์ดพลังวิเศษ และกติกาการแข่งขัน
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
            aria-label="Close guide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('board')}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'board'
                ? 'border-cyan-400 text-cyan-300 shadow-[0_4px_12px_-2px_rgba(6,182,212,0.5)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-4 w-4 text-cyan-400" />
            <span>สัญลักษณ์บนกระดาน</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cards'
                ? 'border-purple-400 text-purple-300 shadow-[0_4px_12px_-2px_rgba(168,85,247,0.5)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span>การ์ดพลังวิเศษ (7 ใบ)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'rules'
                ? 'border-amber-400 text-amber-300 shadow-[0_4px_12px_-2px_rgba(245,158,11,0.5)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4 text-amber-400" />
            <span>กติกาและวิธีเล่น</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: BOARD SPECIAL SQUARES */}
          {activeTab === 'board' && (
            <div className="space-y-3.5">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                บนกระดานเกม WordX จะมีช่องพิเศษที่ช่วยเพิ่มคะแนน หรือมอบความสามารถพิเศษเมื่อวางตัวอักษรทับลงไป:
              </p>

              {/* 1. Lightning Power Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-cyan-500/35 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(6,182,212,0.15)]">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-cyan-300/80 bg-cyan-400/20 shadow-[0_0_16px_rgba(34,211,238,0.5)]">
                  <span className="absolute inset-1 rounded-lg bg-cyan-500/10 blur-[2px]" />
                  <Image
                    src="/light.png"
                    alt="Lightning Cell"
                    width={36}
                    height={36}
                    className="relative object-contain drop-shadow-[0_0_8px_#38bdf8]"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">ช่องสายฟ้า (Lightning Power Cell)</h3>
                    <span className="rounded-md border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                      สุ่มรับการ์ดพลัง
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    เมื่อวางตัวอักษรลงบนช่องสายฟ้า ผู้เล่นจะ <strong className="text-cyan-300">สุ่มได้รับการ์ดพลังวิเศษ (Power Card) 1 ใบ</strong> เข้าสู่มือทันที! (สะสมการ์ดในมือได้สูงสุด 3 ใบ)
                  </p>
                </div>
              </div>

              {/* 2. 3L Triple Letter Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-rose-500/35 bg-gradient-to-r from-rose-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(244,63,94,0.15)]">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-red-400/80 bg-red-950/60 shadow-[0_0_16px_rgba(239,68,68,0.4)]">
                  <span className="absolute inset-1 rounded-full bg-red-500/20 blur-[3px]" />
                  <span className="relative text-xl font-black text-white drop-shadow-[0_2px_8px_rgba(239,68,68,0.8)]">
                    3L
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">ช่อง 3L (Triple Letter Score)</h3>
                    <span className="rounded-md border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                      คะแนนตัวอักษร ×3
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    ตัวอักษรที่ถูกวางลงบนช่องนี้ จะได้รับคะแนนตัวอักษร <strong className="text-rose-300">คูณ 3 เท่า</strong> ในเทิร์นนั้นทันที
                  </p>
                </div>
              </div>

              {/* 3. 2L Double Letter Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-orange-400/80 bg-orange-950/60 shadow-[0_0_16px_rgba(249,115,22,0.4)]">
                  <span className="absolute inset-1 rounded-full bg-orange-500/20 blur-[3px]" />
                  <span className="relative text-xl font-black text-white drop-shadow-[0_2px_8px_rgba(249,115,22,0.8)]">
                    2L
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">ช่อง 2L (Double Letter Score)</h3>
                    <span className="rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                      คะแนนตัวอักษร ×2
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    ตัวอักษรที่ถูกวางลงบนช่องนี้ จะได้รับคะแนนตัวอักษร <strong className="text-amber-300">คูณ 2 เท่า</strong> ในเทิร์นนั้นทันที
                  </p>
                </div>
              </div>

              {/* 4. Center Star */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-500/15 shadow-[0_0_14px_rgba(251,191,36,0.3)]">
                  <Star className="h-7 w-7 text-amber-300 fill-amber-400/40 drop-shadow-[0_0_8px_#fbbf24]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">จุดศูนย์กลางกระดาน (Center Star)</h3>
                    <span className="rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                      จุดเริ่มคำแรก
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    ตำแหน่งกึ่งกลางของกระดาน <strong className="text-amber-200">คำศัพท์แรกของการแข่งขัน</strong> จะต้องวางพาดผ่านช่องดาวนี้เสมอ
                  </p>
                </div>
              </div>

              {/* 5. Wildcard Blank Tile */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-indigo-400/30 bg-gradient-to-r from-indigo-950/30 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-indigo-400/60 bg-gradient-to-br from-indigo-900/80 to-slate-900 text-indigo-300 shadow-[0_0_14px_rgba(129,140,248,0.3)]">
                  <span className="text-2xl font-black text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">★</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">ตัวอักษรว่าง / ไวลด์การ์ด (Blank Wildcard Tile)</h3>
                    <span className="rounded-md border border-indigo-400/40 bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
                      แทนตัวใดก็ได้ (A-Z)
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    แผ่นป้ายอักษรพิเศษไม่มีแต้ม (0 คะแนน) แต่สามารถใช้ <strong className="text-indigo-200">แทนตัวอักษรใดก็ได้ตั้งแต่ A-Z</strong> ช่วยให้ต่อคำศัพท์ยากๆ ได้อย่างอิสระ
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THE 7 POWER CARDS */}
          {activeTab === 'cards' && (
            <div className="space-y-3.5">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                การ์ดพลังวิเศษทั้ง 7 ใบ ได้รับจากการวางตัวอักษรทับช่องสายฟ้า โดยแต่ละใบมีความสามารถในการพลิกสถานการณ์ที่แตกต่างกัน:
              </p>

              {/* 1. HINT */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(245,158,11,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/20 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.35)]">
                  <Eye className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Hint (การ์ดคำใบ้)</h3>
                    <span className="rounded-md border border-amber-400/40 bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                      เทิร์นตนเอง
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    สแกนกระดานและ <strong className="text-amber-300">แสดงคำศัพท์ที่ดีที่สุด 3 อันดับแรก</strong> พร้อมตำแหน่งวางตัวอักษรและคะแนนที่จะได้รับ ช่วยให้หาทางลงคำศัพท์ได้ง่ายขึ้นทันที
                  </p>
                </div>
              </div>

              {/* 2. SHIELD */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-blue-500/40 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(59,130,246,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-400/50 bg-blue-500/20 text-blue-300 shadow-[0_0_16px_rgba(59,130,246,0.35)]">
                  <Shield className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Shield (โล่ป้องกัน)</h3>
                    <span className="rounded-md border border-blue-400/40 bg-blue-500/25 px-2 py-0.5 text-[10px] font-bold text-blue-200">
                      ใช้ได้ตลอดเวลา / โต้กลับ
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    สร้างเกราะคุ้มกันตนเอง เพื่อ <strong className="text-blue-300">ป้องกันความเสียหาย (Damage) หรือการถูกขโมยสลับตัวอักษร (Swap)</strong> จากคู่ต่อสู้ สามารถเปิดเกราะล่วงหน้าหรือกดใช้ตอนถูกโจมตีได้
                  </p>
                </div>
              </div>

              {/* 3. HEAL */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(244,63,94,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-400/50 bg-rose-500/20 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.35)]">
                  <Heart className="h-6 w-6 fill-rose-400/50 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Heal (ฟื้นฟูเลือด)</h3>
                    <span className="rounded-md border border-rose-400/40 bg-rose-500/25 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                      ใช้ได้ตลอดเวลา (HP Mode)
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    <strong className="text-rose-300">ฟื้นฟูพลังชีวิต (HP) ของตนเองทันที</strong> โดยคำนวณแต้มเลือดที่ได้รับจากผลรวมคะแนนตัวอักษรทั้งหมดที่อยู่บนแท่นวาง (Rack) ของเรา
                  </p>
                </div>
              </div>

              {/* 4. DOUBLE_DAMAGE */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(168,85,247,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-purple-400/50 bg-purple-500/20 text-purple-300 shadow-[0_0_16px_rgba(168,85,247,0.35)]">
                  <span className="text-lg font-black tracking-tighter">×2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Word ×2 (ดาเมจสองเท่า)</h3>
                    <span className="rounded-md border border-purple-400/40 bg-purple-500/25 px-2 py-0.5 text-[10px] font-bold text-purple-200">
                      เทิร์นตนเอง (HP Mode)
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    ใช้ก่อนกดยืนยันคำศัพท์ เพื่อเพิ่มพลังโจมตีของคำที่ลงในเทิร์นนั้นเป็น <strong className="text-purple-300">2 เท่าของคะแนนคำศัพท์</strong> โจมตีลด HP ของคู่ต่อสู้ที่เลือกได้อย่างหนักหน่วง!
                  </p>
                </div>
              </div>

              {/* 5. SPY_SWAP */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(16,185,129,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.35)]">
                  <Repeat2 className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Swap Word (จารกรรมสลับตัวอักษร)</h3>
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                      ใช้ได้ตลอดเวลา
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    เลือกตัวอักษรบนแท่นวางของเรา 1-3 ตัว เพื่อ <strong className="text-emerald-300">สลับแลกเปลี่ยนกับตัวอักษรของคู่ต่อสู้</strong> ชิงตัวอักษรดีๆ มาใช้และทิ้งตัวอักษรยากๆ ให้คู่แข่ง
                  </p>
                </div>
              </div>

              {/* 6. FREEZE_TILE */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(6,182,212,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.35)]">
                  <Snowflake className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Freeze Word (สาปแช่แข็งตัวอักษร)</h3>
                    <span className="rounded-md border border-cyan-400/40 bg-cyan-500/25 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                      เทิร์นตนเอง
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    เลือกแช่แข็งตัวอักษรบนกระดาน 1 ตัว ทำให้ <strong className="text-cyan-300">คู่ต่อสู้ทุกคนไม่สามารถนำตัวอักษรมาต่อคำที่ช่องนี้ได้</strong> จนกว่าจะวนกลับมาถึงเทิร์นของเราอีกครั้ง
                  </p>
                </div>
              </div>

              {/* 7. DESTROY_TILE */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-orange-500/40 bg-gradient-to-r from-orange-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(249,115,22,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-orange-400/50 bg-orange-500/20 text-orange-300 shadow-[0_0_16px_rgba(249,115,22,0.35)]">
                  <RotateCcw className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Clear Word (ทำลายตัวอักษร)</h3>
                    <span className="rounded-md border border-orange-400/40 bg-orange-500/25 px-2 py-0.5 text-[10px] font-bold text-orange-200">
                      ใช้ได้ตลอดเวลา
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    เลือกทำลายและ <strong className="text-orange-300">ลบตัวอักษร 1 ตัวออกจากกระดานอย่างถาวร</strong> (ยกเว้นช่องจุดกึ่งกลาง) เพื่อตัดทางต่อคำของคู่ต่อสู้ หรือเปิดช่องคะแนนพิเศษให้เราวางคำใหม่
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RULES & GAME MODES */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              {/* Game Modes */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-400" />
                  <span>โหมดการเล่น (Game Modes)</span>
                </h3>

                <div className="space-y-2.5">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <h4 className="text-sm font-bold text-rose-300 flex items-center gap-1.5">
                      <Heart className="h-4 w-4 fill-rose-400/40" />
                      <span>HP Battle Mode (โหมดต่อสู้พลังชีวิต)</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                      ผู้เล่นทุกคนเริ่มต้นด้วย 100 HP เมื่อผู้เล่นวางคำศัพท์สำเร็จ คะแนนที่ทำได้จะกลายเป็น <strong className="text-rose-300">ดาเมจลด HP ของคู่ต่อสู้ทุกคน</strong> ในเกม! ผู้เล่นที่ HP เหลือ 0 จะถูกคัดออก คนสุดท้ายที่รอดชีวิตคือผู้ชนะ
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                      <Layers className="h-4 w-4" />
                      <span>Turn Count Mode (โหมดนับรอบเทิร์น)</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                      แข่งขันตามจำนวนเทิร์นที่กำหนดไว้ (เช่น 7 เทิร์น) ไม่มีการลดเลือด เน้นการสะสมคะแนนจากคำศัพท์ให้ได้มากที่สุด เมื่อครบกำหนดจำนวนเทิร์น <strong className="text-indigo-300">ผู้ที่มีคะแนนรวมสูงสุดจะเป็นผู้ชนะ</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Special Rules & Mechanics */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-2.5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>กติกาและกลยุทธ์พิเศษ</span>
                </h3>

                <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-amber-300">Bingo Bonus (+50 คะแนน):</strong> หากผู้เล่นสามารถวางตัวอักษรจากแท่นวางได้ครบทั้ง 7 ตัวในเทิร์นเดียว จะได้รับโบนัสบิงโกเพิ่มทันที +50 คะแนน!
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-cyan-300">การสลับตัวอักษร (Exchange Tiles):</strong> หากตัวอักษรบนแท่นวางเล่นยาก สามารถเลือกตัวอักษรเพื่อสลับเปลี่ยนกับถุงตัวอักษรส่วนกลางได้ (จะเสียสิทธิ์ในการวางคำในเทิร์นนั้น)
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-slate-200">การข้ามเทิร์น (Pass Turn):</strong> หากไม่สามารถคิดคำศัพท์ได้ สามารถกด Pass เพื่อข้ามเทิร์นและส่งต่อให้ผู้เล่นถัดไป
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-purple-300">จำกัดเวลาต่อเทิร์น (Turn Timer):</strong> หากหมดเวลาประจำเทิร์น ระบบจะทำการข้ามเทิร์นโดยอัตโนมัติ
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 bg-slate-900/60 px-5 py-3.5 sm:px-6 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            WordX Multiplayer Crossword Game
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2 text-xs sm:text-sm font-bold text-slate-200 transition hover:bg-slate-700 hover:text-white active:scale-95 cursor-pointer"
          >
            เข้าใจแล้ว (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
