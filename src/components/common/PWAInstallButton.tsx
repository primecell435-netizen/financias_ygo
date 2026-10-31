import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, CheckCircle } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>App Instalado</span>
      </div>
    );
  }

  return (
    <>
      {isInstallable ? (
        <button
          onClick={install}
          className={`flex items-center gap-2 font-medium text-white shadow-sm transition-all rounded-xl cursor-pointer ${
            compact
              ? 'bg-brand-navy hover:bg-brand-navy-light px-3 py-1.5 text-xs'
              : 'bg-gradient-to-r from-brand-navy to-brand-blue hover:opacity-95 px-4 py-2.5 text-sm shadow-md'
          }`}
          title="Instalar Meu Financeiro no seu dispositivo"
        >
          <Download className="w-4 h-4 text-brand-gold animate-bounce" />
          <span>{compact ? 'Instalar' : 'Instalar Aplicativo'}</span>
        </button>
      ) : isIOS ? (
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-2 font-medium transition-all rounded-xl cursor-pointer ${
            compact
              ? 'border border-brand-blue/30 text-brand-navy hover:bg-brand-blue-light px-3 py-1.5 text-xs'
              : 'border-2 border-brand-blue/40 text-brand-navy hover:bg-brand-blue-light/50 px-4 py-2 text-sm'
          }`}
        >
          <Smartphone className="w-4 h-4 text-brand-blue" />
          <span>{compact ? 'Instalar no iOS' : 'Instalar no iPhone / iPad'}</span>
        </button>
      ) : (
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-2 font-medium transition-all rounded-xl cursor-pointer text-slate-700 bg-white/80 border border-slate-200 hover:bg-slate-50 ${
            compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
          }`}
          title="Informações de instalação no dispositivo"
        >
          <Download className="w-3.5 h-3.5 text-brand-blue" />
          <span>Instalar PWA</span>
        </button>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand-blue-light rounded-xl text-brand-blue">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-brand-navy">Instalar no Celular</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-sm text-slate-600">
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold shrink-0">
                  1
                </div>
                <div>
                  No navegador Safari ou Chrome, toque no botão <strong>Compartilhar</strong>{' '}
                  <Share className="inline w-4 h-4 text-brand-blue ml-1" />
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold shrink-0">
                  2
                </div>
                <div>
                  Role as opções para cima e selecione{' '}
                  <strong className="text-slate-900">"Adicionar à Tela de Início"</strong>{' '}
                  <PlusSquare className="inline w-4 h-4 text-brand-turquoise ml-1" />
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold shrink-0">
                  3
                </div>
                <div>
                  Confirme em <strong>Adicionar</strong>. O ícone de <em>Meu Financeiro</em> ficará disponível como um app nativo!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full rounded-xl bg-brand-navy hover:bg-brand-navy-dark text-white py-2.5 text-sm font-semibold transition-all shadow-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
