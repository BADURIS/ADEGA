import { supabase } from './supabaseClient';
import { BuscarCepResult, ViaCepResponse } from '@/types/checkout';

export async function buscarCep(cep: string): Promise<BuscarCepResult> {
  const cleanedCep = cep.replace(/\D/g, '');

  if (cleanedCep.length !== 8) {
    return {
      sucesso: false,
      logradouro: '',
      bairro: '',
      cidade: '',
      uf: '',
      taxaEntrega: 0,
      bairroEncontrado: false,
      mensagemErro: 'CEP inválido. Deve conter 8 dígitos numerados.',
    };
  }

  try {
    // 1. Checar primeiro se o CEP exato consta na tabela oficial de ceps_atendidos do banco
    const { data: cepsCadastrados } = await supabase
      .from('ceps_atendidos')
      .select('cep, bairro, valor_frete, ativo')
      .eq('cep', cleanedCep)
      .eq('ativo', true)
      .limit(1);

    // Buscar dados de logradouro no ViaCEP para preenchimento de formulário
    const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
    const dataViaCep: ViaCepResponse = response.ok ? await response.json() : {};

    if (dataViaCep.erro && (!cepsCadastrados || cepsCadastrados.length === 0)) {
      return {
        sucesso: false,
        logradouro: '',
        bairro: '',
        cidade: '',
        uf: '',
        taxaEntrega: 0,
        bairroEncontrado: false,
        mensagemErro: 'CEP não encontrado. Verifique os números digitados.',
      };
    }

    const logradouro = dataViaCep.logradouro || '';
    const bairro = dataViaCep.bairro || (cepsCadastrados?.[0]?.bairro ?? '');
    const cidade = dataViaCep.localidade || 'Santos';
    const uf = dataViaCep.uf || 'SP';

    let taxaEntrega = 0;
    let cepAtendido = false;

    // Se o CEP específico estiver cadastrado e ativo
    if (cepsCadastrados && cepsCadastrados.length > 0) {
      taxaEntrega = Number(cepsCadastrados[0].valor_frete);
      cepAtendido = true;
    } else if (bairro) {
      // Fallback para zonas_frete por bairro
      const { data: zonas } = await supabase
        .from('zonas_frete')
        .select('valor_frete, bairro')
        .ilike('bairro', `%${bairro}%`)
        .eq('ativo', true)
        .limit(1);

      if (zonas && zonas.length > 0) {
        taxaEntrega = Number(zonas[0].valor_frete);
        cepAtendido = true;
      }
    }

    if (!cepAtendido) {
      return {
        sucesso: false,
        logradouro,
        bairro,
        cidade,
        uf,
        taxaEntrega: 0,
        bairroEncontrado: false,
        mensagemErro: 'A Teles Adega não realiza entregas para este CEP no momento. Entre em contato via WhatsApp para consultar taxa especial.',
      };
    }

    return {
      sucesso: true,
      logradouro,
      bairro,
      cidade,
      uf,
      taxaEntrega,
      bairroEncontrado: true,
    };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Erro ao buscar o CEP. Tente novamente.';
    return {
      sucesso: false,
      logradouro: '',
      bairro: '',
      cidade: '',
      uf: '',
      taxaEntrega: 0,
      bairroEncontrado: false,
      mensagemErro: errMessage,
    };
  }
}
