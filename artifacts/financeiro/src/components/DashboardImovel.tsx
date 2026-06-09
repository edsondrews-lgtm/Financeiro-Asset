import React from 'react';
import { Home, Clock, TrendingUp, FileText, ArrowUp, CheckCircle, Hourglass, Settings, CalendarPlus, PlusCircle, RefreshCw, History } from 'lucide-react';

export default function DashboardImovel() {
  const dados = {
    progressoTempo: 68.3,
    mesesRestantes: 18,
    dataEntrega: 'Dezembro/2027',
    progressoPagamento: 48.7,
    valorPago: '211.232,27',
    valorTotal: '433.471,44',
    valorOriginal: '300.000,00',
    valorAtualizado: '433.134,39',
    cubAtual: '3.064,10'
  };

  return (
    <div className="p-8 max-w-6xl mx-auto text-slate-700">
      <div className="flex flex-col items-center justify-center mb-10">
        <div className="flex items-center gap-3 text-blue-600 mb-2">
          <Home size={40} strokeWidth={2.5} />
          <h1 className="text-4xl font-light tracking-tight">Financiamento Imobiliário</h1>
        </div>
        <p className="text-slate-400 font-medium">Controle completo do seu investimento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 p-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 text-cyan-500 font-bold mb-4"><Clock size={20} /><span className="text-lg text-slate-700">Tempo até Entrega das Chaves</span></div>
          <div className="w-full bg-slate-100 rounded-full h-5 mb-3 relative overflow-hidden">
            <div className="bg-cyan-400 h-5 rounded-full flex items-center justify-center transition-all duration-1000" style={{ width: `${dados.progressoTempo}%` }}>
              <span className="text-[10px] text-white font-bold">{dados.progressoTempo}%</span>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-cyan-400 mb-1">{dados.mesesRestantes} meses restantes</h3>
          <p className="text-xs text-slate-400 font-medium">Entrega prevista: {dados.dataEntrega}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 p-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 text-emerald-600 font-bold mb-4"><TrendingUp size={20} /><span className="text-lg text-slate-700">Progresso do Pagamento</span></div>
          <div className="w-full bg-slate-100 rounded-full h-5 mb-3 relative overflow-hidden">
            <div className="bg-emerald-600 h-5 rounded-full flex items-center justify-center transition-all duration-1000" style={{ width: `${dados.progressoPagamento}%` }}>
              <span className="text-[10px] text-white font-bold">{dados.progressoPagamento}%</span>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 mb-1">R$ {dados.valorPago}</h3>
          <p className="text-xs text-slate-400 font-medium">de R$ {dados.valorTotal} total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#6b66d6] rounded-2xl p-6 text-white flex flex-col items-center text-center shadow-md">
          <FileText size={28} className="mb-3 opacity-90" />
          <h3 className="text-3xl font-bold mb-1">R$ {dados.valorOriginal}</h3>
          <span className="text-sm opacity-80 font-medium">Valor Original</span>
        </div>
        <div className="bg-[#fbbf24] rounded-2xl p-6 text-white flex flex-col items-center text-center shadow-md">
          <ArrowUp size={28} className="mb-3 opacity-90" />
          <h3 className="text-3xl font-bold mb-1">R$ {dados.valorAtualizado}</h3>
          <span className="text-sm opacity-80 font-medium">Valor Atualizado</span>
        </div>
        <div className="bg-[#34d399] rounded-2xl p-6 text-white flex flex-col items-center text-center shadow-md">
          <FileText size={28} className="mb-3 opacity-90" />
          <h3 className="text-3xl font-bold mb-1">R$ {dados.cubAtual}</h3>
          <span className="text-sm opacity-80 font-medium">CUB Atual (Mai/2026)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-[#7871e6] p-4 text-white font-semibold flex items-center gap-2"><CheckCircle size={18} /> Total Já Pago</div>
          <div className="p-6 space-y-4">
            {[
              { label: 'Entrada:', value: 'R$ 50.000,00' },
              { label: '1º Reforço da Reserva (12/2023):', value: 'R$ 18.832,22' },
              { label: '2º Reforço da Reserva (09/2024):', value: 'R$ 19.423,71' },
              { label: 'Parcelas mensais pagas (50x):', value: 'R$ 122.976,34' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-slate-100 pb-3">
                <span className="text-slate-500">{item.label}</span>
                <span className="font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
            <div className="flex justify-between text-base pt-2">
              <span className="font-black text-slate-800">TOTAL PAGO:</span>
              <span className="font-black text-emerald-600">R$ {dados.valorPago}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-[#7871e6] p-4 text-white font-semibold flex items-center gap-2"><Hourglass size={18} /> Total a Pagar</div>
          <div className="p-6 space-y-4">
            {[
              { label: '50 parcelas restantes × R$ 2.629,61:', value: 'R$ 131.480,53' },
              { label: 'Escritura (29.62 CUBs × R$ 3.064,10):', value: 'R$ 90.758,64' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-slate-100 pb-3">
                <span className="text-slate-500">{item.label}</span>
                <span className="font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm border-b border-slate-100 pb-3 mt-4">
              <span className="font-bold text-slate-800">Total Restante:</span>
              <span className="font-bold text-amber-500">R$ 222.239,17</span>
            </div>
            <div className="flex justify-between text-sm border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-800">Valor Total do Imóvel:</span>
              <span className="font-bold text-blue-600">R$ {dados.valorTotal}</span>
            </div>
            <div className="flex justify-between text-sm pt-2">
              <span className="font-bold text-slate-800">Estimativa Total Atualizada:</span>
              <span className="font-bold text-blue-600">R$ 373.831,62</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#7871e6] p-4 text-white font-semibold flex items-center gap-2"><Settings size={18} /> Gerenciar Financiamento</div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: CalendarPlus, label: 'Registrar Parcelas', color: 'text-blue-600', hover: 'hover:bg-blue-50' },
            { icon: PlusCircle, label: 'Adicionar Reforço', color: 'text-emerald-600', hover: 'hover:bg-emerald-50' },
            { icon: RefreshCw, label: 'Atualizar CUB', color: 'text-amber-500', hover: 'hover:bg-amber-50' },
            { icon: History, label: 'Ver Histórico', color: 'text-cyan-500', hover: 'hover:bg-cyan-50' },
          ].map(({ icon: Icon, label, color, hover }) => (
            <button key={label} className={`flex flex-col items-center justify-center gap-3 ${color} ${hover} p-4 rounded-xl transition-colors font-semibold text-sm`}>
              <Icon size={28} />{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
