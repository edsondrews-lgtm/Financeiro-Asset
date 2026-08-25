import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import ControleEmpresa from "./views/ControleEmpresa";
import GestorIPTV from "./views/gestor/GestorIPTV";
import SaidasPainel from "./views/SaidasPainel";
import EntradasPessoais from "./views/EntradasPessoais";
import ResumoPessoal from "./views/ResumoPessoal";
import CasaJardimMirante from "./views/CasaJardimMirante";
import Apartamento from "./views/Apartamento";
import PasswordGate from "./components/PasswordGate";
import TrocarSenhaMenu from "./components/TrocarSenhaMenu";
import CarteiraInvestimentos from "./views/CarteiraInvestimentos";
import Consorcios from "./views/Consorcios";
import Caixinhas from "./views/Caixinhas";
import PrevidenciaPainel from "./views/PrevidenciaPainel";
import FGTSPainel from "./views/FGTSPainel";
import Bens from "./views/Bens";
import ExtratosBancarios from "./views/ExtratosBancarios";
import TelegramGastos from "./views/TelegramGastos";
import ParaOndeVaiPainel from "./views/ParaOndeVaiPainel";
import PainelGeral from "./views/PainelGeral";
import ContasRecorrentes from "./views/ContasRecorrentes";
import { usePainelGeral } from "./hooks/usePainelGeral";
import {
  Building2, Home, Wallet, ChevronDown,
  PieChart, FileText, PiggyBank,
  Shield, TrendingUp, CreditCard,
  BedDouble, Trees, BarChart2, Briefcase, Coins,
  Moon, Sun, Eye, EyeOff, Menu, X,
  LayoutDashboard, LogOut, Send, Landmark, ListChecks, Tv,
} from "lucide-react";

export default function App() {
  const hoje = new Date();
  const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const [abaAtiva, setAbaAtiva]                     = useState("geral");
  const [subAbaInvestimento, setSubAbaInvestimento] = useState("acoes");
  const [subAbaPessoal, setSubAbaPessoal]           = useState("resumo");
  const [subAbaImovel, setSubAbaImovel]             = useState("apartamento");
  const [menuInvestimentosAberto, setMenuInvestimentosAberto] = useState(false);
  const [menuPessoalAberto, setMenuPessoalAberto]             = useState(false);
  const [menuImovelAberto, setMenuImovelAberto]               = useState(false);
  const [menuMobileAberto, setMenuMobileAberto]               = useState(false);
  const [mesDash, setMesDash] = useState(String(mesAnterior.getMonth() + 1).padStart(2, "0"));
  const [anoDash, setAnoDash] = useState(String(mesAnterior.getFullYear()));
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('fh-dark-mode') === 'true';
  });
  const [privado, setPrivado] = useState(false);

  const painel = usePainelGeral(mesDash, anoDash);

  // O painel busca os dados uma vez só ao carregar o app; sem isso, qualquer
  // alteração feita em Apartamento, Casa, Ações etc. só aparece aqui depois
  // de um F5 — recarrega toda vez que o usuário volta pra essa aba.
  const primeiraVezGeral = React.useRef(true);
  useEffect(() => {
    if (abaAtiva !== "geral") return;
    if (primeiraVezGeral.current) { primeiraVezGeral.current = false; return; }
    painel.recarregar();
  }, [abaAtiva]);

  // Cobre o caso de duas abas do navegador abertas (uma no Painel Geral, outra
  // no Apartamento por ex.) — sem isso, voltar pra aba do navegador não
  // dispara o efeito acima, que só reage a troca de tela dentro do mesmo app.
  const painelRef = React.useRef(painel);
  painelRef.current = painel;
  const abaAtivaRef = React.useRef(abaAtiva);
  abaAtivaRef.current = abaAtiva;
  useEffect(() => {
    function aoRecuperarFoco() {
      if (document.visibilityState === "visible" && abaAtivaRef.current === "geral") {
        painelRef.current.recarregar();
      }
    }
    document.addEventListener("visibilitychange", aoRecuperarFoco);
    window.addEventListener("focus", aoRecuperarFoco);
    return () => {
      document.removeEventListener("visibilitychange", aoRecuperarFoco);
      window.removeEventListener("focus", aoRecuperarFoco);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark-theme', darkMode);
    localStorage.setItem('fh-dark-mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('valores-ocultos', privado);
  }, [privado]);

  useEffect(() => {
    function fecharMenus(e: MouseEvent) {
      const alvo = e.target as HTMLElement;
      if (!alvo.closest("#menu-investimentos")) setMenuInvestimentosAberto(false);
      if (!alvo.closest("#menu-pessoal"))       setMenuPessoalAberto(false);
      if (!alvo.closest("#menu-imovel"))        setMenuImovelAberto(false);
    }
    document.addEventListener("mousedown", fecharMenus);
    return () => document.removeEventListener("mousedown", fecharMenus);
  }, []);

  // ── nav config ────────────────────────────────────────────────────────────
  const navItems = [
    { id: "geral",   label: "Painel Geral", icon: <LayoutDashboard size={14}/> },
    { id: "empresa", label: "Empresa",      icon: <Building2 size={14}/> },
    { id: "gestor",  label: "Gestor",       icon: <Tv size={14}/> },
    { id: "bens",    label: "Bens",         icon: <Coins size={14}/> },
  ];

  const subItensImovel = [
    { id: "apartamento", label: "Apartamento 810",     icon: <BedDouble size={13}/> },
    { id: "casa",        label: "Casa Jardim Mirante", icon: <Trees size={13}/> },
  ];

  const subItensInvestimento = [
    { id: "acoes",       label: "Ações",       icon: <PieChart size={13}/> },
    { id: "consorcios",  label: "Consórcio",   icon: <FileText size={13}/> },
    { id: "caixinhas",   label: "Caixinhas",   icon: <PiggyBank size={13}/> },
    { id: "previdencia", label: "Previdência", icon: <Shield size={13}/> },
    { id: "fgts",        label: "FGTS",        icon: <Briefcase size={13}/> },
  ];

  const subItensPessoal = [
    { id: "resumo",       label: "Resumo",       icon: <BarChart2 size={13}/> },
    { id: "entradas",     label: "Entradas",     icon: <TrendingUp size={13}/> },
    { id: "saidas",       label: "Saídas",       icon: <CreditCard size={13}/> },
    { id: "contas-fixas", label: "Contas Fixas", icon: <ListChecks size={13}/> },
    { id: "geral-gastos", label: "Pra onde vai", icon: <Landmark size={13}/> },
    { id: "bancos",       label: "Bancos",       icon: <FileText size={13}/> },
    { id: "telegram",     label: "Telegram",     icon: <Send size={13}/> },
  ];

  function selecionarSubImovel(sub: string)       { setSubAbaImovel(sub);       setAbaAtiva("imoveis");       setMenuImovelAberto(false); }
  function selecionarSubInvestimento(sub: string) { setSubAbaInvestimento(sub); setAbaAtiva("investimentos"); setMenuInvestimentosAberto(false); }
  function selecionarSubPessoal(sub: string)      { setSubAbaPessoal(sub);      setAbaAtiva("pessoal");       setMenuPessoalAberto(false); }

  return (
    <PasswordGate>
      <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-600">
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-sm dark-theme" style={darkMode ? { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' } : {}}>
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              FinançasHub
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setDarkMode(d => !d)}
                className="p-2 rounded-xl transition-all"
                style={{ color: 'var(--text-muted)' }}
                title={darkMode ? 'Modo claro' : 'Modo escuro'}>
                {darkMode ? <Sun size={16}/> : <Moon size={16}/>}
              </button>
              <button onClick={() => setPrivado(p => !p)}
                className={`p-2 rounded-xl transition-all ${privado ? 'text-amber-500' : ''}`}
                style={privado ? {} : { color: 'var(--text-muted)' }}
                title={privado ? 'Mostrar valores' : 'Ocultar valores'}>
                {privado ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
              <TrocarSenhaMenu/>
              <button onClick={() => supabase.auth.signOut()}
                className="p-2 rounded-xl transition-all"
                style={{ color: 'var(--text-muted)' }}
                title="Sair">
                <LogOut size={16}/>
              </button>
              <button onClick={() => setMenuMobileAberto(v => !v)}
                className="p-2 rounded-xl transition-all md:hidden"
                style={{ color: 'var(--text-muted)' }}>
                {menuMobileAberto ? <X size={20}/> : <Menu size={20}/>}
              </button>
              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/40 dark-theme" style={darkMode ? { backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' } : {}}>
              {navItems.map(item => (
                <button key={item.id} onClick={() => setAbaAtiva(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${abaAtiva === item.id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  {item.icon} {item.label}
                </button>
              ))}
              {/* Imóveis */}
              <div id="menu-imovel" className="relative">
                <button onClick={() => setMenuImovelAberto(v => !v)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${abaAtiva === "imoveis" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  <Home size={14}/> Imóveis
                  <ChevronDown size={12} className={`transition-transform ${menuImovelAberto ? "rotate-180" : ""}`}/>
                </button>
                {menuImovelAberto && (
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 min-w-[170px] z-50">
                    {subItensImovel.map(sub => (
                      <button key={sub.id} onClick={() => selecionarSubImovel(sub.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors text-left ${abaAtiva === "imoveis" && subAbaImovel === sub.id ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50"}`}>
                        {sub.icon} {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Pessoal */}
              <div id="menu-pessoal" className="relative">
                <button onClick={() => setMenuPessoalAberto(v => !v)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${abaAtiva === "pessoal" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  <Wallet size={14}/> Pessoal
                  <ChevronDown size={12} className={`transition-transform ${menuPessoalAberto ? "rotate-180" : ""}`}/>
                </button>
                {menuPessoalAberto && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 min-w-[150px] z-50">
                    {subItensPessoal.map(sub => (
                      <button key={sub.id} onClick={() => selecionarSubPessoal(sub.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors text-left ${abaAtiva === "pessoal" && subAbaPessoal === sub.id ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50"}`}>
                        {sub.icon} {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Investimentos */}
              <div id="menu-investimentos" className="relative">
                <button onClick={() => setMenuInvestimentosAberto(v => !v)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${abaAtiva === "investimentos" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                  <PiggyBank size={14}/> Investimentos
                  <ChevronDown size={12} className={`transition-transform ${menuInvestimentosAberto ? "rotate-180" : ""}`}/>
                </button>
                {menuInvestimentosAberto && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 min-w-[150px] z-50">
                    {subItensInvestimento.map(sub => (
                      <button key={sub.id} onClick={() => selecionarSubInvestimento(sub.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors text-left ${abaAtiva === "investimentos" && subAbaInvestimento === sub.id ? "text-blue-600 bg-blue-50" : "text-slate-600 hover:bg-slate-50"}`}>
                        {sub.icon} {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </nav>
            </div>
          </div>

          {/* Mobile drawer menu */}
          {menuMobileAberto && (
            <div className="md:hidden border-t" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <nav className="max-w-7xl mx-auto px-4 py-3 space-y-1">
                {navItems.map(item => (
                  <button key={item.id} onClick={() => { setAbaAtiva(item.id); setMenuMobileAberto(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${abaAtiva === item.id ? "text-blue-600" : ""}`}
                    style={abaAtiva === item.id ? { backgroundColor: 'var(--bg-tertiary)' } : { color: 'var(--text-primary)' }}>
                    {item.icon} {item.label}
                  </button>
                ))}

                <div className="pt-2 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest px-4 mb-1" style={{ color: 'var(--text-muted)' }}>Imóveis</p>
                </div>
                {subItensImovel.map(sub => (
                  <button key={sub.id} onClick={() => { selecionarSubImovel(sub.id); setMenuMobileAberto(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${abaAtiva === "imoveis" && subAbaImovel === sub.id ? "text-blue-600" : ""}`}
                    style={abaAtiva === "imoveis" && subAbaImovel === sub.id ? { backgroundColor: 'var(--bg-tertiary)' } : { color: 'var(--text-primary)' }}>
                    {sub.icon} {sub.label}
                  </button>
                ))}

                <div className="pt-2 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest px-4 mb-1" style={{ color: 'var(--text-muted)' }}>Pessoal</p>
                </div>
                {subItensPessoal.map(sub => (
                  <button key={sub.id} onClick={() => { selecionarSubPessoal(sub.id); setMenuMobileAberto(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${abaAtiva === "pessoal" && subAbaPessoal === sub.id ? "text-blue-600" : ""}`}
                    style={abaAtiva === "pessoal" && subAbaPessoal === sub.id ? { backgroundColor: 'var(--bg-tertiary)' } : { color: 'var(--text-primary)' }}>
                    {sub.icon} {sub.label}
                  </button>
                ))}

                <div className="pt-2 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest px-4 mb-1" style={{ color: 'var(--text-muted)' }}>Investimentos</p>
                </div>
                {subItensInvestimento.map(sub => (
                  <button key={sub.id} onClick={() => { selecionarSubInvestimento(sub.id); setMenuMobileAberto(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${abaAtiva === "investimentos" && subAbaInvestimento === sub.id ? "text-blue-600" : ""}`}
                    style={abaAtiva === "investimentos" && subAbaInvestimento === sub.id ? { backgroundColor: 'var(--bg-tertiary)' } : { color: 'var(--text-primary)' }}>
                    {sub.icon} {sub.label}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {abaAtiva === "imoveis" && (
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-2 flex items-center gap-1 overflow-x-auto flex-nowrap" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
              {subItensImovel.map(sub => (
                <button key={sub.id} onClick={() => setSubAbaImovel(sub.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${subAbaImovel === sub.id ? "bg-cyan-100 text-cyan-700" : "text-slate-400 hover:text-slate-600"}`}>
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>
          )}
          {abaAtiva === "investimentos" && (
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-2 flex items-center gap-1 overflow-x-auto flex-nowrap" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
              {subItensInvestimento.map(sub => (
                <button key={sub.id} onClick={() => setSubAbaInvestimento(sub.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${subAbaInvestimento === sub.id ? "bg-indigo-100 text-indigo-700" : "text-slate-400 hover:text-slate-600"}`}>
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>
          )}
          {abaAtiva === "pessoal" && (
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-2 flex items-center gap-1 overflow-x-auto flex-nowrap" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
              {subItensPessoal.map(sub => (
                <button key={sub.id} onClick={() => setSubAbaPessoal(sub.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${subAbaPessoal === sub.id ? "bg-teal-100 text-teal-700" : "text-slate-400 hover:text-slate-600"}`}>
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>
          )}
        </header>

        <main>
          {abaAtiva === "geral"   && (
            <PainelGeral
              mesDash={mesDash} anoDash={anoDash}
              setMesDash={setMesDash} setAnoDash={setAnoDash}
              setAbaAtiva={setAbaAtiva}
              selecionarSubImovel={selecionarSubImovel}
              selecionarSubInvestimento={selecionarSubInvestimento}
              selecionarSubPessoal={selecionarSubPessoal}
              painel={painel}
            />
          )}
          {abaAtiva === "empresa" && <ControleEmpresa />}
          {abaAtiva === "gestor"  && <GestorIPTV />}
          {abaAtiva === "bens"    && <Bens />}
          {abaAtiva === "imoveis" && subAbaImovel === "apartamento" && <Apartamento />}
          {abaAtiva === "imoveis" && subAbaImovel === "casa"        && <CasaJardimMirante />}
          {abaAtiva === "pessoal" && subAbaPessoal === "resumo"     && <ResumoPessoal />}
          {abaAtiva === "pessoal" && subAbaPessoal === "entradas"   && <EntradasPessoais />}
          {abaAtiva === "pessoal" && subAbaPessoal === "saidas"     && <SaidasPainel />}
          {abaAtiva === "pessoal" && subAbaPessoal === "contas-fixas" && <ContasRecorrentes />}
          {abaAtiva === "pessoal" && subAbaPessoal === "geral-gastos" && <ParaOndeVaiPainel />}
          {abaAtiva === "pessoal" && subAbaPessoal === "bancos"     && <ExtratosBancarios />}
          {abaAtiva === "pessoal" && subAbaPessoal === "telegram"   && <TelegramGastos />}
          {abaAtiva === "investimentos" && subAbaInvestimento === "acoes"       && <CarteiraInvestimentos />}
          {abaAtiva === "investimentos" && subAbaInvestimento === "consorcios"  && <Consorcios />}
          {abaAtiva === "investimentos" && subAbaInvestimento === "caixinhas"   && <Caixinhas onTotalCalculado={painel.setTotalCaixinhas} />}
          {abaAtiva === "investimentos" && subAbaInvestimento === "previdencia" && <PrevidenciaPainel />}
          {abaAtiva === "investimentos" && subAbaInvestimento === "fgts"        && <FGTSPainel />}
        </main>
      </div>
    </PasswordGate>
  );
}