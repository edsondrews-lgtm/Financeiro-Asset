import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { corParaCategoria } from '../lib/categoriaFallback';

interface Gasto {
  categoria?: string;
  valor?: number;
}

export default function GraficoGastos({ gastos, corPorNome = {} }: { gastos: Gasto[]; corPorNome?: Record<string, string> }) {
  const dados = gastos.reduce((acc: Record<string, number>, curr) => {
    const cat = curr.categoria || 'Outros';
    acc[cat] = (acc[cat] || 0) + (Number(curr.valor) || 0);
    return acc;
  }, {});

  const dataFormatada = Object.keys(dados).map(cat => ({ name: cat, value: dados[cat] }));

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-80">
      <h4 className="text-sm font-bold text-slate-700 mb-4">Distribuição por Categoria</h4>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie data={dataFormatada} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
            {dataFormatada.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={corParaCategoria(entry.name, corPorNome)} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: '10px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
