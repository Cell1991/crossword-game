'use client';

import React from 'react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface BlankTilePickerModalProps {
  isOpen: boolean;
  onSelect: (letter: string) => void;
  onClose: () => void;
}

export const BlankTilePickerModal: React.FC<BlankTilePickerModalProps> = ({
  isOpen,
  onSelect,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl border border-sky-400/40 bg-gradient-to-b from-[#0e1c38]/95 via-[#091326]/95 to-[#040814]/95 p-6 shadow-[0_0_50px_rgba(56,189,248,0.25)] text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-sky-900/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 text-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.4)]">
              <svg viewBox="0 0 24 24" className="w-6 h-6 animate-pulse" fill="currentColor">
                <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-sky-200">เลือกตัวอักษรสำหรับแผ่น Blank</h3>
              <p className="text-xs text-slate-400">เลือกตัวอักษร A-Z ที่ต้องการให้แผ่นนี้แปลงร่างเป็น (มีค่า 0 คะแนน)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Letters A-Z Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-7 gap-2.5 py-5 max-h-[60vh] overflow-y-auto">
          {LETTERS.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => onSelect(letter)}
              className="group relative flex flex-col items-center justify-center h-13 sm:h-15 rounded-xl border border-sky-400/30 bg-gradient-to-b from-[#23407a] via-[#1a305e] to-[#122244] shadow-[0_4px_10px_rgba(0,0,0,0.5)] hover:scale-105 hover:border-sky-300 hover:from-[#2563eb] hover:to-[#1d4ed8] hover:shadow-[0_0_16px_rgba(56,189,248,0.6)] active:scale-95 transition-all cursor-pointer select-none overflow-hidden"
            >
              {/* Glass Top Bevel Highlight */}
              <div className="absolute inset-x-1 top-0.5 h-[35%] rounded-t-lg bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />

              <span className="relative z-10 text-2xl sm:text-3xl font-quakduck text-white group-hover:text-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {letter}
              </span>
              <span className="absolute bottom-1 right-1.5 text-[9px] sm:text-[10px] font-mono text-sky-300 font-bold opacity-75 group-hover:opacity-100">
                0
              </span>
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-3 border-t border-sky-900/40 text-xs text-slate-400">
          <span>✨ คุณสามารถเปลี่ยนตัวอักษรได้ตลอดก่อนกดยืนยันตาเล่น</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};
