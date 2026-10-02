'use client';
import { useState, useCallback } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export const EnableNotify = () => {
  const [perm, setPerm] = useState<NotificationPermission | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async () => {
    if (!('Notification' in window)) {
      setError('Browser does not support Notifications');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPerm(result);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const test = () => {
    if (perm === 'granted') {
      new Notification('Crossword‑Game', {
        body: 'ทดสอบการแจ้งเตือนจากเกม',
        icon: '/favicon.ico',
      });
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-slate-900/60">
      {perm === 'granted' ? (
        <>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span>เปิดใช้การแจ้งเตือนแล้ว</span>
          </div>
          <button
            onClick={test}
            className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-500 rounded"
          >
            ทดลองแจ้งเตือน
          </button>
        </>
      ) : (
        <button
          onClick={request}
          className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded"
        >
          เปิดใช้การแจ้งเตือน
        </button>
      )}
      {error && (
        <p className="text-red-400 text-xs">
          <XCircle className="inline w-3 h-3 mr-1" />
          {error}
        </p>
      )}
    </div>
  );
};
