import React, { useState, useEffect } from "react";
import { KeyRound, Check } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function TrocarSenhaMenu() {
  const [aberto, setAberto]       = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro]           = useState("");
  const [sucesso, setSucesso]     = useState(false);
  const [enviando, setEnviando]   = useState(false);

  useEffect(() => {
    if (!aberto) return;
    function fecharAoClicarFora(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("#menu-trocar-senha")) setAberto(false);
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, [aberto]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (novaSenha.length < 6) { setErro("Mínimo 6 caracteres"); return; }
    if (novaSenha !== confirmar) { setErro("As senhas não coincidem"); return; }

    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setEnviando(false);

    if (error) { setErro(error.message); return; }

    setSucesso(true);
    setNovaSenha("");
    setConfirmar("");
    setTimeout(() => { setSucesso(false); setAberto(false); }, 1500);
  }

  return (
    <div id="menu-trocar-senha" className="relative">
      <button onClick={() => setAberto(v => !v)}
        className="p-2 rounded-xl transition-all"
        style={{ color: 'var(--text-muted)' }}
        title="Trocar senha">
        <KeyRound size={16}/>
      </button>
      {aberto && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-100 p-4 w-64 z-50">
          {sucesso ? (
            <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
              <Check size={14}/> Senha atualizada!
            </p>
          ) : (
            <form onSubmit={salvar} className="space-y-2.5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nova senha</p>
              <input
                type="password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Nova senha"
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              />
              <input
                type="password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Confirmar senha"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              />
              {erro && <p className="text-[11px] text-rose-500 font-semibold">{erro}</p>}
              <button
                type="submit"
                disabled={enviando}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-60"
              >
                {enviando ? "Salvando..." : "Salvar"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
