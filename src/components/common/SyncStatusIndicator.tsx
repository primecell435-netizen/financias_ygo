import React, { useState } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  CloudOff,
  Clock,
  AlertTriangle,
  Cloud,
  ChevronDown,
} from 'lucide-react';
import { SyncStatusType } from '../../services/firestoreService';

interface SyncStatusIndicatorProps {
  status: SyncStatusType;
  lastSyncedAt?: Date | null;
  errorMessage?: string | null;
  pendingCount?: number;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  status,
  lastSyncedAt,
  errorMessage,
  pendingCount = 0,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusBadge = () => {
    switch (status) {
      case 'syncing':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-blue" />
            <span className="hidden sm:inline">Sincronizando...</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>{pendingCount > 0 ? `${pendingCount} pendente(s)` : 'Gravando...'}</span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
            <CloudOff className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Offline (Cache ativo)</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Erro na Nuvem</span>
          </div>
        );
      case 'synced':
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Sincronizado</span>
          </div>
        );
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1 cursor-pointer hover:opacity-90 transition"
        title="Status da Sincronização com o Cloud Firestore"
      >
        {getStatusBadge()}
      </button>

      {showDetails && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white p-3.5 shadow-xl border border-slate-200 z-50 text-xs text-slate-600 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Cloud className="w-4 h-4 text-brand-blue" />
              <span>Cloud Firestore</span>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1">
            <p className="font-semibold text-slate-800">
              {status === 'synced' && 'Todos os dados estão sincronizados em tempo real com a nuvem.'}
              {status === 'syncing' && 'Comunicação em andamento com o Cloud Firestore.'}
              {status === 'pending' && 'Existem alterações locais sendo enviadas para o servidor.'}
              {status === 'offline' && 'Sem conexão com a internet. Os dados continuam salvos no dispositivo e serão sincronizados automaticamente assim que a conexão retornar.'}
              {status === 'error' && (errorMessage || 'Falha ao sincronizar dados com o Firebase.')}
            </p>
            {lastSyncedAt && (
              <p className="text-[11px] text-slate-400">
                Última confirmação: {lastSyncedAt.toLocaleTimeString('pt-BR')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
