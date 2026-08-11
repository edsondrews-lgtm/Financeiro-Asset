import { useState } from 'react';
import {
  Tv, LayoutDashboard, Users, BellRing, Undo2, AppWindow, ClipboardList,
} from 'lucide-react';
import '../../styles/gestor.css';
import { PainelIPTV } from './PainelIPTV';
import { ClientesIPTV } from './ClientesIPTV';
import { AvisosIPTV } from './AvisosIPTV';
import { RecuperacaoIPTV } from './RecuperacaoIPTV';
import { AplicativosIPTV } from './AplicativosIPTV';
import { DadosIncompletosIPTV } from './DadosIncompletosIPTV';

const TABS = [
  { id: 'painel', label: 'Painel', icon: <LayoutDashboard size={13} /> },
  { id: 'clientes', label: 'Clientes', icon: <Users size={13} /> },
  { id: 'avisos', label: 'Avisos', icon: <BellRing size={13} /> },
  { id: 'recuperacao', label: 'Recuperação', icon: <Undo2 size={13} /> },
  { id: 'aplicativos', label: 'Aplicativos', icon: <AppWindow size={13} /> },
  { id: 'dados', label: 'Dados Incompletos', icon: <ClipboardList size={13} /> },
];

export default function GestorIPTV() {
  const [subAba, setSubAba] = useState('painel');

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-7">

        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200">
            <Tv size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestor</h1>
            <p className="text-slate-400 text-xs font-semibold mt-0.5">Clientes, vencimentos e cobrança</p>
          </div>
        </div>

        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-2xl w-fit shadow-sm flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setSubAba(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${subAba === t.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {subAba === 'painel' && <PainelIPTV />}
        {subAba === 'clientes' && <ClientesIPTV />}
        {subAba === 'avisos' && <AvisosIPTV />}
        {subAba === 'recuperacao' && <RecuperacaoIPTV />}
        {subAba === 'aplicativos' && <AplicativosIPTV />}
        {subAba === 'dados' && <DadosIncompletosIPTV />}

      </div>
    </div>
  );
}
