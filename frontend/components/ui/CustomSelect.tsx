'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  id,
  placeholder = 'Select an option',
  className = '',
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = useCallback((val: string) => {
    onChange(val);
    setIsOpen(false);
  }, [onChange]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border bg-slate-900/90 px-3.5 py-2.5 sm:py-3 text-sm sm:text-base outline-none transition-all cursor-pointer ${
          isOpen
            ? 'border-amber-400/80 ring-2 ring-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.15)] bg-slate-900 text-white'
            : 'border-white/10 text-white hover:border-white/20 hover:bg-slate-900'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="truncate font-medium">
          {selectedOption ? selectedOption.label : <span className="text-slate-500">{placeholder}</span>}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-amber-300' : ''
          }`}
        />
      </button>

      {/* Floating Glassmorphism Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-activedescendant={value}
          className="absolute z-50 left-0 right-0 top-[calc(100%+6px)] max-h-60 overflow-y-auto rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-amber-400/30 shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_25px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/20 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {options.map(option => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-400/20 to-amber-500/10 text-amber-200 border border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="truncate">{option.label}</span>
                  {option.sublabel && (
                    <span className="text-[10px] text-slate-400 font-normal truncate">{option.sublabel}</span>
                  )}
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-amber-400 shrink-0 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
