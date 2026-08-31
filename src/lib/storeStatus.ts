export interface StoreStatusResult {
  aberto: boolean;
  statusTexto: string;
  badgeCor: string;
  horarioTexto: string;
  horarioAbertura: string;
  horarioFechamento: string;
}

/**
 * Calcula o status de funcionamento dinâmico da adega tratando cruzamento de meia-noite.
 * Exemplo: Abertura 18:00 / Fechamento 02:00 -> Aberto das 18:00 às 23:59 e das 00:00 às 02:00.
 */
export function checkStoreOpeningStatus(
  horarioAbertura = '18:00',
  horarioFechamento = '02:00',
  statusManual: 'auto' | 'forcado_aberto' | 'forcado_fechado' = 'auto',
  now: Date = new Date()
): StoreStatusResult {
  if (statusManual === 'forcado_aberto') {
    return {
      aberto: true,
      statusTexto: '🟢 ABERTO',
      badgeCor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      horarioTexto: `Funcionamento: ${horarioAbertura} às ${horarioFechamento}`,
      horarioAbertura,
      horarioFechamento,
    };
  }

  if (statusManual === 'forcado_fechado') {
    return {
      aberto: false,
      statusTexto: '🔴 ENCERRADA',
      badgeCor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
      horarioTexto: `Voltamos às ${horarioAbertura}`,
      horarioAbertura,
      horarioFechamento,
    };
  }

  const [abHora, abMin] = horarioAbertura.split(':').map(Number);
  const [feHora, feMin] = horarioFechamento.split(':').map(Number);

  const aberturaMinutes = (abHora || 18) * 60 + (abMin || 0);
  const fechamentoMinutes = (feHora || 2) * 60 + (feMin || 0);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let aberto = false;

  if (fechamentoMinutes < aberturaMinutes) {
    // Cruzamento de meia-noite (ex.: 18:00 -> 02:00)
    aberto = currentMinutes >= aberturaMinutes || currentMinutes < fechamentoMinutes;
  } else {
    // Mesmo dia (ex.: 10:00 -> 22:00)
    aberto = currentMinutes >= aberturaMinutes && currentMinutes < fechamentoMinutes;
  }

  return {
    aberto,
    statusTexto: aberto ? '🟢 ABERTO' : '🔴 ENCERRADA',
    badgeCor: aberto
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      : 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    horarioTexto: aberto
      ? `Funcionamento: ${horarioAbertura} às ${horarioFechamento}`
      : `Voltamos às ${horarioAbertura}`,
    horarioAbertura,
    horarioFechamento,
  };
}
