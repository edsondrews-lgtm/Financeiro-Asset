import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import ControleEmpresa from './views/ControleEmpresa';
import SaidasPainel from './views/SaidasPainel';
import DashboardImovel from './components/DashboardImovel';
import PasswordGate from './components/PasswordGate';
import { LayoutDashboard, Building2, Home, User, Wallet, ArrowUpRight, DollarSign, Percent, TrendingUp } from 'lucide-react';

interface Nota {
  valor: number;
}

interface Despesa {
  valor: number;
  periodicidade: string;
}

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState('geral');
  const [loading, setLoading] = useState(false);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);

  useEffect(() => { buscarDadosGlobais(); }, []);

  async function buscarDadosGlobais() {
    setLoading(true);
    try {
      const { data: dataNotas } = await supabase.from('empresa_notas_fiscais').select('*');
      if (dataNotas) setNotas(dataNotas);
      const { data: dataDespesas } = await supabase.from('empresa_despesas').select('*');
      if (dataDespesas) setDespesas(dataDespesas);
    } catch (error) { console.error('Erro ao consolidar painel geral:', error); }
    finally { setLoading(false); }
  }

  const totalFaturamento = notas.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const totalImpostos = totalFaturamento * 0.06;
  const totalCustos = despesas.reduce((acc, curr) => {
    const v = Number(curr.valor) || 0;
    return curr.periodicidade === 'Anual' ? acc + (v / 12) : acc + v;
  }, 0);
  const lucroConsolidado = totalFaturamento - totalImpostos - totalCustos;

  const navItems = [
    { id: 'geral', label: 'Painel Geral', icon: <LayoutDashboard size={14} /> },
    { id: 'empresa', label: 'Empresa', icon: <Building2 size={14} /> },
    { id: 'imoveis', label: 'Imóveis', icon: <Home size={14} /> },
    { id: 'pessoal', label: 'Pessoal', icon: <User size={14} /> },
    { id: 'investimentos', label: 'Investimentos', icon: <Wallet size={14} />, disabled: true },
  ];

  const PainelGeral = () => (
    <div className="p-10 space-y-8 max-w-7xl mx-auto text-slate-700">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-100">
          <LayoutDashboard size={24} />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Painel Geral</h2>
          <p className="text-slate-500 text-sm font-medium">Consolidado de faturamento, fluxo de caixa corporativo e despesas de 2026</p>
        </div>
      </div>

      {loading && <p className="text-xs font-bold text-indigo-600 animate-pulse">Atualizando fluxos consolidados...</p>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Faturamento Bruto</span>
            <h3 className="text-2xl font-black text-slate-800">R$ {totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <span className="text-[10px] text-emerald-600 font-bold">Entradas Ativas</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><ArrowUpRight size={20} /></div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Custos Operacionais</span>
            <h3 className="text-2xl font-black text-slate-800">R$ {totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <span className="text-[10px] text-slate-500 font-medium">Mensais + Rateios Anuais</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><DollarSign size={20} /></div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Provisão de Impostos</span>
            <h3 className="text-2xl font-black text-slate-800">R$ {totalImpostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <span className="text-[10px] text-amber-600 font-bold">Simples Nacional (6%)</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Percent size={18} /></div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-sm flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block">Lucro Líquido Real</span>
            <h3 className="text-2xl font-black text-emerald-400">R$ {lucroConsolidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <span className="text-[10px] text-slate-300 font-medium">Faturamento disponível líquido</span>
          </div>
          <div className="p-3 bg-white/10 text-emerald-400 rounded-xl"><TrendingUp size={20} /></div>
        </div>
      </div>

      <div className="p-6 bg-blue-50/40 rounded-2xl border border-blue-100/60 flex gap-4 items-start">
        <div className="p-2 bg-blue-600 text-white rounded-lg mt-0.5"><TrendingUp size={16} /></div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-blue-900">Análise de Performance Operacional</h4>
          <p className="text-xs text-blue-700 leading-relaxed font-medium">
            Este painel consolida em tempo real todas as Notas Fiscais emitidas e subtrai os custos cadastrados na aba da Empresa, aplicando o desconto proporcional de impostos. Use este fluxo para monitorar a saúde financeira geral da sua operação.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <PasswordGate>
      <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-600">
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              FinançasHub
            </span>
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/40">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setAbaAtiva(item.id)}
                  disabled={item.disabled}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    item.disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : abaAtiva === item.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main>
          {abaAtiva === 'geral' && <PainelGeral />}
          {abaAtiva === 'empresa' && <ControleEmpresa />}
          {abaAtiva === 'pessoal' && <SaidasPainel />}
          {abaAtiva === 'imoveis' && <DashboardImovel />}
        </main>
      </div>
    </PasswordGate>
  );
}
