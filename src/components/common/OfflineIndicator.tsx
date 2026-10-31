import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/95 text-white px-4 py-2.5 text-xs font-semibold shadow-lg backdrop-blur-xs border border-amber-400/40 animate-pulse">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Modo Offline — Os dados continuam disponíveis localmente no PWA.</span>
    </div>
  );
};
