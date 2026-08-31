'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/services/supabaseClient';
import { Categoria, Produto } from '@/types/storefront';

// Schema de validação do formulário com Zod
export const produtoFormSchema = z.object({
  nome: z
    .string()
    .min(2, 'O nome do produto deve ter no mínimo 2 caracteres')
    .max(150, 'Nome muito longo (máximo 150 caracteres)'),
  categoria_id: z
    .string()
    .min(1, 'Selecione uma categoria para o produto'),
  descricao: z.string().optional(),
  preco: z
    .number()
    .min(0, 'O preço não pode ser negativo'),
  foto_url: z.string().optional().or(z.literal('')),
  estoque_atual: z
    .number()
    .int('O estoque deve ser um número inteiro')
    .min(0, 'O estoque não pode ser negativo'),
  estoque_minimo: z
    .number()
    .int('O estoque mínimo deve ser um número inteiro')
    .min(0, 'O estoque mínimo não pode ser negativo'),
  ativo: z.boolean().default(true),
  destaque: z.boolean().default(false),
});

export type ProdutoFormData = z.infer<typeof produtoFormSchema>;

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (produto: Produto, isEdit: boolean) => void;
  produtoParaEditar?: Produto | null;
  categorias: Categoria[];
}

export function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  produtoParaEditar,
  categorias,
}: ProductFormModalProps) {
  const isEditing = !!produtoParaEditar;

  const [nome, setNome] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [precoInput, setPrecoInput] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [estoqueAtual, setEstoqueAtual] = useState('0');
  const [estoqueMinimo, setEstoqueMinimo] = useState('5');
  const [ativo, setAtivo] = useState(true);
  const [destaque, setDestaque] = useState(false);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preencher os dados caso seja edição ou resetar ao abrir
  useEffect(() => {
    if (isOpen) {
      setFormErrors({});
      if (produtoParaEditar) {
        setNome(produtoParaEditar.nome || '');
        setCategoriaId(produtoParaEditar.categoria_id || '');
        setDescricao(produtoParaEditar.descricao || '');
        setPrecoInput(Number(produtoParaEditar.preco || 0).toFixed(2).replace('.', ','));
        setFotoUrl(produtoParaEditar.foto_url || '');
        setEstoqueAtual(String(produtoParaEditar.estoque_atual ?? 0));
        setEstoqueMinimo(String(produtoParaEditar.estoque_minimo ?? 5));
        setAtivo(produtoParaEditar.ativo ?? true);
        setDestaque(produtoParaEditar.destaque ?? false);
        setShowUrlInput(!!produtoParaEditar.foto_url && !produtoParaEditar.foto_url.includes('supabase'));
      } else {
        setNome('');
        setCategoriaId(categorias.length > 0 ? categorias[0].id : '');
        setDescricao('');
        setPrecoInput('');
        setFotoUrl('');
        setEstoqueAtual('10');
        setEstoqueMinimo('5');
        setAtivo(true);
        setDestaque(false);
        setShowUrlInput(false);
      }
    }
  }, [isOpen, produtoParaEditar, categorias]);

  if (!isOpen) return null;

  // Função para tratar o upload de imagem para o bucket do Supabase
  const handleFileUpload = async (file: File) => {
    try {
      if (!file.type.startsWith('image/')) {
        setFormErrors((prev) => ({ ...prev, foto_url: 'Selecione um arquivo de imagem válido (PNG, JPG, WEBP)' }));
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setFormErrors((prev) => ({ ...prev, foto_url: 'A imagem deve ter no máximo 5MB' }));
        return;
      }

      setUploadingImage(true);
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.foto_url;
        return next;
      });

      const fileExt = file.name.split('.').pop() || 'jpg';
      const cleanFileName = file.name
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');
      const fileName = `${Date.now()}-${cleanFileName}.${fileExt}`;
      const filePath = `produtos/${fileName}`;

      // Upload para o bucket 'produtos'
      const { error: uploadError } = await supabase.storage
        .from('produtos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        // Se bucket não existir ou permissão falhar, gerar preview local temporário com data URL e alertar
        console.warn('Aviso no upload Supabase Storage, usando data URL como fallback:', uploadError);
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setFotoUrl(e.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Obter URL pública do Supabase Storage
        const { data: publicData } = supabase.storage.from('produtos').getPublicUrl(filePath);
        if (publicData?.publicUrl) {
          setFotoUrl(publicData.publicUrl);
        }
      }
    } catch (err: unknown) {
      console.error('Erro ao fazer upload da imagem:', err);
      setFormErrors((prev) => ({ ...prev, foto_url: 'Falha no upload da imagem' }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const parsePreco = (val: string): number => {
    const sanitized = val.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(sanitized);
    return isNaN(num) ? 0 : num;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const numericPreco = parsePreco(precoInput);
    const numericEstoqueAtual = parseInt(estoqueAtual, 10);
    const numericEstoqueMinimo = parseInt(estoqueMinimo, 10);

    const payloadRaw = {
      nome: nome.trim(),
      categoria_id: categoriaId,
      descricao: descricao.trim() || undefined,
      preco: numericPreco,
      foto_url: fotoUrl.trim() || undefined,
      estoque_atual: isNaN(numericEstoqueAtual) ? 0 : numericEstoqueAtual,
      estoque_minimo: isNaN(numericEstoqueMinimo) ? 5 : numericEstoqueMinimo,
      ativo,
      destaque,
    };

    // Validação Zod
    const validation = produtoFormSchema.safeParse(payloadRaw);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setFormErrors(errors);
      return;
    }

    try {
      setSaving(true);

      const dbPayload = {
        nome: payloadRaw.nome,
        categoria_id: payloadRaw.categoria_id,
        descricao: payloadRaw.descricao || null,
        preco: payloadRaw.preco,
        foto_url: payloadRaw.foto_url || null,
        estoque_atual: payloadRaw.estoque_atual,
        estoque_minimo: payloadRaw.estoque_minimo,
        ativo: payloadRaw.ativo,
        atualizado_em: new Date().toISOString(),
      };

      if (isEditing && produtoParaEditar) {
        const { data, error } = await supabase
          .from('produtos')
          .update(dbPayload)
          .eq('id', produtoParaEditar.id)
          .select(`*, categoria:categorias(nome)`)
          .single();

        if (error) throw error;
        onSuccess((data as Produto) || { ...produtoParaEditar, ...dbPayload }, true);
      } else {
        const { data, error } = await supabase
          .from('produtos')
          .insert([dbPayload])
          .select(`*, categoria:categorias(nome)`)
          .single();

        if (error) throw error;
        onSuccess((data as Produto) || ({ id: 'temp-' + Date.now(), ...dbPayload } as unknown as Produto), false);
      }

      onClose();
    } catch (err: unknown) {
      console.error('Erro ao salvar produto no Supabase:', err);
      const errMessage = err instanceof Error ? err.message : 'Ocorreu um erro ao salvar o produto no banco de dados.';
      setFormErrors((prev) => ({
        ...prev,
        general: errMessage,
      }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#161616] border border-[#262626] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header do Modal */}
        <div className="px-6 py-5 border-b border-[#262626] flex items-center justify-between bg-[#111111]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                {isEditing ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isEditing
                  ? 'Atualize os dados, estoque ou imagem do produto'
                  : 'Cadastre um novo item no catálogo do TELES ADEGA'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-zinc-400 hover:text-white hover:border-zinc-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com Scroll Suave */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {formErrors.general && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{formErrors.general}</span>
            </div>
          )}

          {/* Seção 1: Upload e Preview de Foto */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center justify-between">
              <span>Foto do Produto</span>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-[11px] text-[#F59E0B] hover:underline flex items-center gap-1 font-semibold capitalize"
              >
                <LinkIcon className="w-3 h-3" />
                {showUrlInput ? 'Usar Upload de Imagem' : 'Inserir URL direta'}
              </button>
            </label>

            {showUrlInput ? (
              <div className="space-y-3">
                <input
                  type="url"
                  placeholder="https://exemplo.com/foto-produto.jpg"
                  value={fotoUrl}
                  onChange={(e) => setFotoUrl(e.target.value)}
                  className="w-full h-12 bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white px-4 rounded-xl text-sm outline-none transition"
                />
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  dragActive
                    ? 'border-[#F59E0B] bg-[#F59E0B]/5'
                    : 'border-[#262626] hover:border-[#F59E0B]/60 bg-[#0D0D0D]/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                {uploadingImage ? (
                  <div className="py-4 flex flex-col items-center gap-2 text-[#F59E0B]">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-bold">Enviando imagem para o Supabase...</span>
                  </div>
                ) : fotoUrl ? (
                  <div className="flex items-center gap-4 w-full justify-between" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl bg-[#161616] border border-[#262626] overflow-hidden flex items-center justify-center shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fotoUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Foto carregada
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate max-w-[200px] sm:max-w-xs">
                          {fotoUrl}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-[#262626] hover:bg-[#333333] text-xs font-semibold text-white transition"
                      >
                        Trocar
                      </button>
                      <button
                        type="button"
                        onClick={() => setFotoUrl('')}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                        title="Remover foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 flex flex-col items-center gap-2 text-zinc-400">
                    <div className="w-12 h-12 rounded-2xl bg-[#161616] border border-[#262626] flex items-center justify-center text-zinc-400">
                      <Upload className="w-5 h-5 text-[#F59E0B]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        Arraste uma foto ou <span className="text-[#F59E0B] underline">clique para enviar</span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">Formatos suportados: PNG, JPG ou WEBP (até 5MB)</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {formErrors.foto_url && (
              <p className="text-xs text-red-400 mt-1.5">{formErrors.foto_url}</p>
            )}
          </div>

          {/* Seção 2: Dados Básicos (Nome & Categoria) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Nome do Produto <span className="text-[#F59E0B]">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Heineken Long Neck 330ml"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={`w-full h-12 bg-[#0D0D0D] border ${
                  formErrors.nome ? 'border-red-500' : 'border-[#262626]'
                } focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white px-4 rounded-xl text-sm font-medium outline-none transition`}
              />
              {formErrors.nome && (
                <p className="text-xs text-red-400 mt-1">{formErrors.nome}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Categoria <span className="text-[#F59E0B]">*</span>
              </label>
              <div className="relative">
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className={`w-full h-12 bg-[#0D0D0D] border ${
                    formErrors.categoria_id ? 'border-red-500' : 'border-[#262626]'
                  } focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white px-4 rounded-xl text-sm font-medium outline-none transition appearance-none cursor-pointer`}
                >
                  <option value="" disabled className="bg-[#161616] text-zinc-500">
                    Selecione uma categoria...
                  </option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#161616] text-white">
                      {c.nome}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              {formErrors.categoria_id && (
                <p className="text-xs text-red-400 mt-1">{formErrors.categoria_id}</p>
              )}
            </div>
          </div>

          {/* Seção 3: Preço e Estoque */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Preço de Venda */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Preço de Venda (R$) <span className="text-[#F59E0B]">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">
                  R$
                </div>
                <input
                  type="text"
                  placeholder="0,00"
                  value={precoInput}
                  onChange={(e) => setPrecoInput(e.target.value)}
                  className={`w-full h-12 bg-[#0D0D0D] border ${
                    formErrors.preco ? 'border-red-500' : 'border-[#262626]'
                  } focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-[#F59E0B] font-black pl-11 pr-4 rounded-xl text-base outline-none transition`}
                />
              </div>
              {formErrors.preco && (
                <p className="text-xs text-red-400 mt-1">{formErrors.preco}</p>
              )}
            </div>

            {/* Estoque Atual */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Estoque Atual <span className="text-[#F59E0B]">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={estoqueAtual}
                  onChange={(e) => setEstoqueAtual(e.target.value)}
                  className={`w-full h-12 bg-[#0D0D0D] border ${
                    formErrors.estoque_atual ? 'border-red-500' : 'border-[#262626]'
                  } focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white font-mono font-bold px-4 rounded-xl text-base outline-none transition`}
                />
              </div>
              {formErrors.estoque_atual && (
                <p className="text-xs text-red-400 mt-1">{formErrors.estoque_atual}</p>
              )}
            </div>

            {/* Estoque Mínimo (Alerta) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Estoque Mínimo <span className="text-zinc-500 font-normal">(Alerta)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(e.target.value)}
                  className={`w-full h-12 bg-[#0D0D0D] border ${
                    formErrors.estoque_minimo ? 'border-red-500' : 'border-[#262626]'
                  } focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white font-mono font-bold px-4 rounded-xl text-base outline-none transition`}
                />
              </div>
              {formErrors.estoque_minimo && (
                <p className="text-xs text-red-400 mt-1">{formErrors.estoque_minimo}</p>
              )}
            </div>
          </div>

          {/* Seção 4: Descrição do Produto */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Descrição do Produto <span className="text-zinc-500 font-normal">(Opcional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Cerveja Puro Malte Premium 330ml gelada trincando..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-[#0D0D0D] border border-[#262626] focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] text-white p-3.5 rounded-xl text-sm outline-none transition resize-none"
            />
          </div>

          {/* Seção 5: Toggles de Status e Destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Toggle Ativo na Loja */}
            <div className="p-4 rounded-2xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Exibir na Loja / Vitrine</p>
                <p className="text-xs text-zinc-500">Clientes podem visualizar e comprar</p>
              </div>
              <button
                type="button"
                onClick={() => setAtivo(!ativo)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                  ativo ? 'bg-emerald-500' : 'bg-[#262626]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    ativo ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle Produto Destaque */}
            <div className="p-4 rounded-2xl bg-[#0D0D0D] border border-[#262626] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                  Produto em Destaque
                </p>
                <p className="text-xs text-zinc-500">Aparece no topo do catálogo</p>
              </div>
              <button
                type="button"
                onClick={() => setDestaque(!destaque)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                  destaque ? 'bg-[#F59E0B]' : 'bg-[#262626]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    destaque ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer com Botões de Ação */}
          <div className="pt-4 border-t border-[#262626] flex flex-col-reverse sm:flex-row items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#0D0D0D] border border-[#262626] text-zinc-300 hover:text-white hover:border-zinc-500 font-bold text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#F59E0B] hover:bg-[#d97706] text-black font-black text-sm shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Salvar Alterações'
              ) : (
                '+ Cadastrar Produto'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
