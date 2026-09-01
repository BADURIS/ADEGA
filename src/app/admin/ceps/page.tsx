'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, Plus, FileSpreadsheet, Search, Loader2, Edit3, Trash2, ToggleLeft, ToggleRight, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';

export interface CepAtendido {
  id: string;
  cep: string;
  bairro: string;
  valor_frete: number;
  ativo: boolean;
  criado_em?: string;
}

export default function AdminCepsPage() {
  const [ceps, setCeps] = useState<CepAtendido[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal para CEP Individual
  const [isIndividualModalOpen, setIsIndividualModalOpen] = useState(false);
  const [editingCep, setEditingCep] = useState<CepAtendido | null>(null);
  const [inputCep, setInputCep] = useState('');
  const [inputBairro, setInputBairro] = useState('');
  const [inputFrete, setInputFrete] = useState('7.00');
  const [inputAtivo, setInputAtivo] = useState(true);
  const [savingIndividual, setSavingIndividual] = useState(false);

  // Modal para Cadastro em Massa
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBairro, setBulkBairro] = useState('Cubatão / Baixada Santista');
  const [bulkFrete, setBulkFrete] = useState('7.00');
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkResultado, setBulkResultado] = useState<string | null>(null);

  const fetchCeps = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ceps_atendidos')
        .select('*')
        .order('cep', { ascending: true });

      if (error) throw error;
      setCeps((data as CepAtendido[]) || []);
    } catch (err) {
      console.error('Erro ao buscar CEPs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCeps();
  }, [fetchCeps]);

  const handleToggleAtivo = async (cepItem: CepAtendido) => {
    setUpdatingId(cepItem.id);
    const novoStatus = !cepItem.ativo;

    // Atualização otimista
    setCeps((prev) =>
      prev.map((c) => (c.id === cepItem.id ? { ...c, ativo: novoStatus } : c))
    );

    try {
      const { error } = await supabase
        .from('ceps_atendidos')
        .update({ ativo: novoStatus })
        .eq('id', cepItem.id);

      if (error) throw error;
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Erro ao alterar status';
      setCeps((prev) =>
        prev.map((c) => (c.id === cepItem.id ? { ...c, ativo: cepItem.ativo } : c))
      );
      alert(`Erro: ${errMessage}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCep = inputCep.replace(/\D/g, '');

    if (cleanCep.length !== 8) {
      alert('Informe um CEP válido com 8 dígitos.');
      return;
    }

    if (!inputBairro.trim()) {
      alert('Informe o bairro ou cidade.');
      return;
    }

    setSavingIndividual(true);
    try {
      const frete = parseFloat(inputFrete) || 7.0;

      if (editingCep) {
        const { error } = await supabase
          .from('ceps_atendidos')
          .update({
            cep: cleanCep,
            bairro: inputBairro,
            valor_frete: frete,
            ativo: inputAtivo,
          })
          .eq('id', editingCep.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('ceps_atendidos').insert({
          cep: cleanCep,
          bairro: inputBairro,
          valor_frete: frete,
          ativo: inputAtivo,
        });

        if (error) throw error;
      }

      setIsIndividualModalOpen(false);
      resetIndividualForm();
      fetchCeps();
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Erro ao salvar';
      alert(`Erro ao salvar CEP: ${errMessage}`);
    } finally {
      setSavingIndividual(false);
    }
  };

  const handleDeleteCep = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente este CEP?')) return;

    try {
      const { error } = await supabase.from('ceps_atendidos').delete().eq('id', id);
      if (error) throw error;
      fetchCeps();
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Erro ao excluir';
      alert(`Erro ao excluir: ${errMessage}`);
    }
  };

  // Cadastro em Massa com sanitização de duplicados e validação de 8 dígitos
  const handleSaveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkResultado(null);

    // Extrair todos os números com 8 dígitos do textarea
    const rawTokens = bulkText.split(/[\n,;\s]+/);
    const validCepsSet = new Set<string>();

    rawTokens.forEach((token) => {
      const clean = token.replace(/\D/g, '');
      if (clean.length === 8) {
        validCepsSet.add(clean);
      }
    });

    const uniqueCepsList = Array.from(validCepsSet);

    if (uniqueCepsList.length === 0) {
      alert('Nenhum CEP válido de 8 dígitos foi encontrado no texto digitado.');
      return;
    }

    setSavingBulk(true);
    try {
      const frete = parseFloat(bulkFrete) || 7.0;
      const payloadJson = uniqueCepsList.map((cep) => ({
        cep,
        bairro: bulkBairro || 'Cubatão / Baixada Santista',
        valor_frete: frete,
      }));

      // Tenta via RPC importar_ceps_em_massa
      const { data: rpcData, error: rpcError } = await supabase.rpc('importar_ceps_em_massa', {
        p_ceps: payloadJson,
      });

      if (!rpcError && rpcData) {
        setBulkResultado(`✓ Cadastro concluído com sucesso! Processados: ${rpcData.total_processados || uniqueCepsList.length} CEPs.`);
      } else {
        // Fallback de inserção em lote direta via Supabase Client
        const upsertPayload = uniqueCepsList.map((cep) => ({
          cep,
          bairro: bulkBairro || 'Cubatão / Baixada Santista',
          valor_frete: frete,
          ativo: true,
        }));

        const { error: upsertError } = await supabase
          .from('ceps_atendidos')
          .upsert(upsertPayload, { onConflict: 'cep' });

        if (upsertError) throw upsertError;
        setBulkResultado(`✓ Cadastro em massa de ${uniqueCepsList.length} CEPs concluído com sucesso!`);
      }

      fetchCeps();
      setTimeout(() => {
        setIsBulkModalOpen(false);
        setBulkText('');
        setBulkResultado(null);
      }, 2000);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Erro no cadastro em massa';
      alert(`Erro no cadastro em massa: ${errMessage}`);
    } finally {
      setSavingBulk(false);
    }
  };

  const resetIndividualForm = () => {
    setEditingCep(null);
    setInputCep('');
    setInputBairro('');
    setInputFrete('7.00');
    setInputAtivo(true);
  };

  const openEditModal = (c: CepAtendido) => {
    setEditingCep(c);
    setInputCep(c.cep);
    setInputBairro(c.bairro);
    setInputFrete(String(c.valor_frete));
    setInputAtivo(c.ativo);
    setIsIndividualModalOpen(true);
  };

  const formatarCepDisplay = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      return `${clean.slice(0, 5)}-${clean.slice(5)}`;
    }
    return val;
  };

  const filteredCeps = ceps.filter(
    (c) =>
      c.cep.includes(searchTerm.replace(/\D/g, '')) ||
      c.bairro.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#262626] pb-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-[#F59E0B]" />
            Gerenciamento de CEPs & Área de Entrega
          </h1>
          <p className="text-xs text-zinc-400">
            Cadastre os CEPs atendidos para permitir compras na loja e definir o valor do frete
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              resetIndividualForm();
              setIsIndividualModalOpen(true);
            }}
            className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#0D0D0D] font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow"
          >
            <Plus className="w-4 h-4" />
            Adicionar CEP
          </button>

          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="px-4 py-2 bg-[#161616] hover:bg-[#222222] border border-[#262626] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#F59E0B]" />
            Importar em Massa
          </button>
        </div>
      </div>

      {/* Pesquisa & Métricas */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#161616] border border-[#262626] p-4 rounded-2xl">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
          <input
            type="text"
            placeholder="Pesquisar por CEP ou Bairro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white pl-9 pr-4 py-2 rounded-xl text-xs outline-none transition"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400 w-full sm:w-auto justify-between sm:justify-end">
          <span>Total cadastrados: <strong className="text-white">{ceps.length}</strong></span>
          <span>Ativos: <strong className="text-emerald-400">{ceps.filter((c) => c.ativo).length}</strong></span>
        </div>
      </div>

      {/* Tabela de CEPs */}
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin mx-auto" />
        </div>
      ) : (
        <div className="bg-[#161616] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#0D0D0D] border-b border-[#262626] text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">CEP</th>
                  <th className="py-3.5 px-4">Bairro / Cidade</th>
                  <th className="py-3.5 px-4">Taxa de Frete</th>
                  <th className="py-3.5 px-4">Status de Entrega</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {filteredCeps.map((c) => (
                  <tr key={c.id} className="hover:bg-[#222222]/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-white text-sm">
                      {formatarCepDisplay(c.cep)}
                    </td>
                    <td className="py-3 px-4 text-zinc-300 font-medium">{c.bairro}</td>
                    <td className="py-3 px-4 font-bold text-[#F59E0B]">
                      R$ {Number(c.valor_frete).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        disabled={updatingId === c.id}
                        onClick={() => handleToggleAtivo(c)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition ${
                          c.ativo
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                        }`}
                      >
                        {updatingId === c.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : c.ativo ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-emerald-400" />
                            <span>Ativo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-rose-400" />
                            <span>Inativo</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#222222] rounded-lg transition"
                          title="Editar CEP"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCep(c.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition"
                          title="Excluir CEP"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal CEP Individual */}
      {isIndividualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-[#262626] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsIndividualModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#262626] pb-3">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingCep ? 'Editar CEP Atendido' : 'Novo CEP de Entrega'}
                </h3>
                <p className="text-xs text-zinc-400">Configure o CEP e o frete correspondente</p>
              </div>
            </div>

            <form onSubmit={handleSaveIndividual} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">CEP (8 dígitos)</label>
                <input
                  type="text"
                  placeholder="Ex: 11500000"
                  value={inputCep}
                  onChange={(e) => setInputCep(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm font-mono outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Bairro / Cidade</label>
                <input
                  type="text"
                  placeholder="Ex: Centro - Cubatão"
                  value={inputBairro}
                  onChange={(e) => setInputBairro(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Taxa de Frete (R$)</label>
                  <input
                    type="number"
                    step="0.50"
                    value={inputFrete}
                    onChange={(e) => setInputFrete(e.target.value)}
                    className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-4 py-2.5 rounded-xl text-sm font-bold outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Status</label>
                  <select
                    value={inputAtivo ? 'true' : 'false'}
                    onChange={(e) => setInputAtivo(e.target.value === 'true')}
                    className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-2.5 rounded-xl text-xs font-bold outline-none transition"
                  >
                    <option value="true">Ativo (Entregando)</option>
                    <option value="false">Inativo (Bloqueado)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingIndividual}
                className="w-full py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0D0D0D] font-bold text-xs rounded-xl shadow-lg shadow-[#F59E0B]/10 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {savingIndividual ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Salvar CEP
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cadastro em Massa */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-[#262626] rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#262626] pb-3">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Importação / Cadastro em Massa de CEPs</h3>
                <p className="text-xs text-zinc-400">Cole uma lista com vários CEPs (separados por linha ou vírgula)</p>
              </div>
            </div>

            <form onSubmit={handleSaveBulk} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Cole os CEPs abaixo (Ex: 11500-000, 11500-001...):
                </label>
                <textarea
                  rows={6}
                  placeholder={`11500-000\n11500-001\n11500-002\n11500-003`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white p-3 rounded-xl text-xs font-mono outline-none transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Bairro / Região Padrão</label>
                  <input
                    type="text"
                    value={bulkBairro}
                    onChange={(e) => setBulkBairro(e.target.value)}
                    className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-2 rounded-xl text-xs outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Taxa Padrão (R$)</label>
                  <input
                    type="number"
                    step="0.50"
                    value={bulkFrete}
                    onChange={(e) => setBulkFrete(e.target.value)}
                    className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] text-white px-3 py-2 rounded-xl text-xs font-bold outline-none transition"
                  />
                </div>
              </div>

              {bulkResultado && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-bold">
                  {bulkResultado}
                </div>
              )}

              <button
                type="submit"
                disabled={savingBulk}
                className="w-full py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0D0D0D] font-bold text-xs rounded-xl shadow-lg shadow-[#F59E0B]/10 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {savingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Sanitizar e Importar CEPs em Massa
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
