import React, { useState, useMemo } from 'react';
import {
  CalendarCheck,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  X,
  Tag,
  Users,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { FinancialNote } from '../../types/finance';
import { formatDate, getTodayDateString } from '../../utils/formatters';

export const NotesAgendaView: React.FC = () => {
  const { notes, clients, createNote, toggleNote, deleteNote } = useFinance();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'completed'>('all');

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'reminder' | 'collection' | 'general' | 'visit'>('collection');
  const [targetDate, setTargetDate] = useState(getTodayDateString());
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [selectedClientId, setSelectedClientId] = useState('');

  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => {
        if (filterType === 'pending') return !n.isCompleted;
        if (filterType === 'completed') return n.isCompleted;
        return true;
      })
      .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
  }, [notes, filterType]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate) return;

    const cli = clients.find((c) => c.id === selectedClientId);

    await createNote({
      title: title.trim(),
      content: content.trim(),
      type,
      targetDate,
      priority,
      isCompleted: false,
      clientId: selectedClientId || undefined,
      clientName: cli ? cli.name : undefined,
    });

    setTitle('');
    setContent('');
    setIsAddModalOpen(false);
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'high':
        return <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Alta Prioridade</span>;
      case 'medium':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Média</span>;
      default:
        return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Baixa</span>;
    }
  };

  const getTypeLabel = (t: string) => {
    switch (t) {
      case 'collection':
        return 'Cobrança';
      case 'visit':
        return 'Visita';
      case 'reminder':
        return 'Lembrete';
      default:
        return 'Anotação';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-brand-navy tracking-tight">
            Anotações e Agenda de Cobranças
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Agende ligações, visitas, compromissos financeiros e lembretes de cobrança com datas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-white border border-slate-200 p-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === 'all' ? 'bg-brand-navy text-white' : 'text-slate-600'
              }`}
            >
              Todos ({notes.length})
            </button>
            <button
              onClick={() => setFilterType('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === 'pending' ? 'bg-brand-navy text-white' : 'text-slate-600'
              }`}
            >
              Pendentes ({notes.filter((n) => !n.isCompleted).length})
            </button>
            <button
              onClick={() => setFilterType('completed')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterType === 'completed' ? 'bg-brand-navy text-white' : 'text-slate-600'
              }`}
            >
              Concluídos ({notes.filter((n) => n.isCompleted).length})
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-brand-gold" />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">Nenhum compromisso agendado</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Crie lembretes de cobrança e anotações para nunca esquecer de cobrar seus clientes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`p-5 rounded-2xl bg-white border transition shadow-xs hover:shadow-md flex flex-col justify-between ${
                note.isCompleted ? 'border-slate-200 opacity-60' : 'border-slate-200'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleNote(note.id)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer ${
                        note.isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 hover:border-brand-navy'
                      }`}
                    >
                      {note.isCompleted && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        note.type === 'collection'
                          ? 'bg-brand-blue-light text-brand-blue'
                          : 'bg-brand-turquoise-light text-brand-turquoise'
                      }`}
                    >
                      {getTypeLabel(note.type)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {getPriorityBadge(note.priority)}
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3
                    className={`text-sm font-extrabold ${
                      note.isCompleted ? 'line-through text-slate-400' : 'text-brand-navy'
                    }`}
                  >
                    {note.title}
                  </h3>
                  {note.content && (
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                      {note.content}
                    </p>
                  )}
                </div>

                {note.clientName && (
                  <p className="text-xs text-brand-blue font-semibold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Cliente: {note.clientName}</span>
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Para: <strong>{formatDate(note.targetDate)}</strong>
                </span>
                <span className="text-[11px]">
                  {note.isCompleted ? 'Concluído' : 'Pendente'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: NOVO AGENDAMENTO */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 modal-scroll-container">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-brand-navy">Novo Agendamento / Lembrete</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título do Lembrete</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ligar para cobrar parcela da Maria"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-blue outline-none bg-white"
                  >
                    <option value="collection">Cobrança</option>
                    <option value="reminder">Lembrete</option>
                    <option value="visit">Visita Presencial</option>
                    <option value="general">Geral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prioridade</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-blue outline-none bg-white"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Data Prevista</label>
                <input
                  type="date"
                  required
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:border-brand-blue outline-none"
                />
              </div>

              {clients.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vincular a um Cliente (opcional)
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-blue outline-none bg-white"
                  >
                    <option value="">Nenhum cliente vinculado</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição / Detalhes</label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais para o momento do contato..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-blue outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 keyboard-safe-bottom">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
