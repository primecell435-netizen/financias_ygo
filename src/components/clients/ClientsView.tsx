import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageCircle,
  FileText,
  MapPin,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Client } from '../../types/finance';
import {
  formatCurrency,
  formatDate,
  formatPhone,
  generateWhatsAppLink,
} from '../../utils/formatters';

interface ClientsViewProps {
  onNavigateToSale?: () => void;
  onNavigateToReceivableClient?: (clientId: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  onNavigateToSale,
  onNavigateToReceivableClient,
}) => {
  const { clients, installments, sales, createClient, updateClient, deleteClient, deleteSale } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);

  // In-app deletion confirmation states
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<{ saleId: string; description: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDocument, setFormDocument] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.document && c.document.includes(q))
      );
    });
  }, [clients, searchQuery]);

  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormName('');
    setFormPhone('');
    setFormDocument('');
    setFormAddress('');
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (c: Client) => {
    setEditingClient(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormDocument(c.document || '');
    setFormAddress(c.address || '');
    setFormNotes(c.notes || '');
    setIsAddModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      showNotification('error', 'Nome e telefone são campos obrigatórios.');
      return;
    }

    try {
      if (editingClient) {
        await updateClient(editingClient.id, {
          name: formName.trim(),
          phone: formPhone.trim(),
          document: formDocument.trim() || undefined,
          address: formAddress.trim() || undefined,
          notes: formNotes.trim() || undefined,
          observation: formNotes.trim() || undefined,
        });
        showNotification('success', 'Cliente atualizado com sucesso!');
      } else {
        await createClient({
          name: formName.trim(),
          phone: formPhone.trim(),
          document: formDocument.trim() || undefined,
          address: formAddress.trim() || undefined,
          notes: formNotes.trim() || undefined,
          observation: formNotes.trim() || undefined,
        });
        showNotification('success', 'Cliente cadastrado com sucesso!');
      }
      setIsAddModalOpen(false);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Erro ao salvar cliente.');
    }
  };

  const handleRequestDeleteClient = (client: Client) => {
    setClientToDelete(client);
  };

  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteClient(clientToDelete.id);
      if (res.success) {
        showNotification('success', res.message);
        if (selectedClientForDetails?.id === clientToDelete.id) {
          setSelectedClientForDetails(null);
        }
        setClientToDelete(null);
      } else {
        showNotification('error', res.message);
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Erro ao excluir cliente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteSale = async () => {
    if (!saleToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteSale(saleToDelete.saleId);
      if (res.success) {
        showNotification('success', 'Venda e parcelas excluídas com sucesso.');
        setSaleToDelete(null);
      } else {
        showNotification('error', res.message || 'Erro ao excluir venda.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Erro ao excluir venda.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Compute metrics per client
  const clientMetrics = useMemo(() => {
    const map: Record<
      string,
      { totalDebt: number; totalPaid: number; countOpen: number; countOverdue: number }
    > = {};

    for (const inst of installments) {
      if (inst.isTransferred) continue;
      if (!map[inst.clientId]) {
        map[inst.clientId] = { totalDebt: 0, totalPaid: 0, countOpen: 0, countOverdue: 0 };
      }

      map[inst.clientId].totalPaid += inst.paidAmount;

      if (inst.status !== 'paid') {
        map[inst.clientId].totalDebt += inst.remainingAmount;
        map[inst.clientId].countOpen += 1;
        if (inst.isOverdue) {
          map[inst.clientId].countOverdue += 1;
        }
      }
    }
    return map;
  }, [installments]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 lg:pb-8">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-bold animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-brand-navy tracking-tight">
            Carteira de Clientes
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Gerencie contatos, saldos em aberto e histórico financeiro de cada cliente.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar por nome ou fone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white focus:border-brand-blue outline-none transition"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-brand-gold" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-blue-light text-brand-blue flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            {searchQuery ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado ainda.'}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Cadastre seus clientes para gerenciar as vendas fiadas e emitir lembretes de cobrança via WhatsApp.
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-navy text-white text-xs font-bold hover:bg-brand-navy-light cursor-pointer"
          >
            <Plus className="w-4 h-4 text-brand-gold" />
            <span>Cadastrar Primeiro Cliente</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const metrics = clientMetrics[client.id] || {
              totalDebt: 0,
              totalPaid: 0,
              countOpen: 0,
              countOverdue: 0,
            };

            return (
              <div
                key={client.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-brand-navy leading-tight">
                        {client.name}
                      </h3>
                      {client.document && (
                        <p className="text-[11px] text-slate-400 font-medium">Doc: {client.document}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(client)}
                        className="p-1.5 text-slate-400 hover:text-brand-blue rounded-lg hover:bg-slate-50 transition"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRequestDeleteClient(client)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Phone & WhatsApp link */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {formatPhone(client.phone)}
                    </span>

                    <a
                      href={generateWhatsAppLink(
                        client.phone,
                        `Olá ${client.name}, tudo bem? Sou da administração financeira e estou entrando em contato para acompanhar seus pedidos.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold transition text-[11px]"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </div>

                  {client.address && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.address}</span>
                    </p>
                  )}
                </div>

                {/* Financial status summary for this client */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Saldo em aberto:</span>
                    <span
                      className={`font-black text-sm ${
                        metrics.totalDebt > 0
                          ? metrics.countOverdue > 0
                            ? 'text-rose-600'
                            : 'text-brand-navy'
                          : 'text-emerald-600'
                      }`}
                    >
                      {formatCurrency(metrics.totalDebt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {metrics.countOpen} parcela(s) pendente(s)
                      {metrics.countOverdue > 0 && (
                        <strong className="text-rose-600 ml-1">({metrics.countOverdue} em atraso)</strong>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {onNavigateToReceivableClient && metrics.countOpen > 0 && (
                        <button
                          onClick={() => onNavigateToReceivableClient(client.id)}
                          className="text-xs font-bold text-brand-navy hover:text-brand-blue flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Ver Parcelas</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedClientForDetails(client)}
                        className="text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        Detalhes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD / EDIT CLIENT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 modal-scroll-container">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-brand-navy text-white">
                  <Users className="w-5 h-5 text-brand-gold" />
                </div>
                <h3 className="text-base font-bold text-brand-navy">
                  {editingClient ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Pereira"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Telefone / WhatsApp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="(00) 00000-0000"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CPF ou Documento (opcional)
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={formDocument}
                  onChange={(e) => setFormDocument(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Endereço / Ponto de Referência (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Rua das Flores, 120 - Centro"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Anotações internas sobre o cliente (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sempre paga dia 10, prefere chave Pix"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:border-brand-blue outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 keyboard-safe-bottom">
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
                  {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLIENT DETAILS (HISTÓRICO FINANCEIRO COMPLETO) */}
      {selectedClientForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-navy text-white flex items-center justify-center font-bold">
                  {selectedClientForDetails.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-black text-brand-navy">
                    {selectedClientForDetails.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formatPhone(selectedClientForDetails.phone)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClientForDetails(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of client's installments */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Parcelas e Vendas Fiadas deste Cliente
              </h4>
              {installments.filter((i) => i.clientId === selectedClientForDetails.id).length ===
              0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Nenhuma venda fiada vinculada a este cliente ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {installments
                    .filter((i) => i.clientId === selectedClientForDetails.id)
                    .map((inst) => (
                      <div
                        key={inst.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800">
                            {inst.productDescription} (Parcela {inst.installmentNumber}/{inst.totalInstallments})
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Vencimento: {formatDate(inst.dueDate)} • Status:{' '}
                            <strong
                              className={
                                inst.status === 'paid'
                                  ? 'text-emerald-600'
                                  : inst.isOverdue
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                              }
                            >
                              {inst.status === 'paid'
                                ? 'Quitada'
                                : inst.isOverdue
                                ? 'Atrasada'
                                : 'Em aberto'}
                            </strong>
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <p className="font-black text-brand-navy">
                              {formatCurrency(inst.remainingAmount)}
                            </p>
                            {inst.paidAmount > 0 && (
                              <p className="text-[10px] text-emerald-600 font-semibold">
                                Pago: {formatCurrency(inst.paidAmount)}
                              </p>
                            )}
                          </div>
                          {inst.saleId && (
                            <button
                              type="button"
                              onClick={() =>
                                setSaleToDelete({
                                  saleId: inst.saleId,
                                  description: `${inst.productDescription} (Venda #${inst.saleId.slice(-6)})`,
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Excluir/Cancelar venda fiada"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedClientForDetails(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM CLIENT DELETION */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Confirmar Exclusão de Cliente</h3>
                <p className="text-xs text-slate-500">{clientToDelete.name}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza de que deseja excluir o cadastro de <strong>{clientToDelete.name}</strong>? Por segurança, o sistema não permite excluir clientes que possuam parcelas em aberto.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteClient}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM SALE DELETION */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Confirmar Exclusão de Venda</h3>
                <p className="text-xs text-slate-500">{saleToDelete.description}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Esta ação cancelará e removerá permanentemente esta venda e todas as suas parcelas do Cloud Firestore. Esta ação não poderá ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setSaleToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteSale}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir Venda'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
