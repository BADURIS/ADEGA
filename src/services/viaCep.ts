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
      mensagemErro: 'CEP inválido. Deve conter 8 dígitos.',
    };
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
    
    if (!response.ok) {
      throw new Error('Falha ao conectar com o serviço ViaCEP.');
    }

    const data: ViaCepResponse = await response.json();

    if (data.erro) {
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

    const logradouro = data.logradouro || '';
    const bairro = data.bairro || '';
    const cidade = data.localidade || '';
    const uf = data.uf || '';

    let taxaEntrega = 0;
    let bairroEncontrado = false;

    if (bairro) {
      const { data: zonas, error } = await supabase
        .from('zonas_frete')
        .select('valor_frete, bairro')
        .ilike('bairro', `%${bairro}%`)
        .eq('ativo', true)
        .limit(1);

      if (!error && zonas && zonas.length > 0) {
        taxaEntrega = Number(zonas[0].valor_frete);
        bairroEncontrado = true;
      }
    }

    return {
      sucesso: true,
      logradouro,
      bairro,
      cidade,
      uf,
      taxaEntrega,
      bairroEncontrado,
      mensagemErro: bairroEncontrado
        ? undefined
        : 'Bairro não cadastrado em nossa área de entrega padrão. Entre em contato via WhatsApp para consultar frete especial.',
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
