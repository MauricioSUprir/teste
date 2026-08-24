"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const grupos: { titulo: string; itens: { href: string; label: string }[] }[] = [
  {
    titulo: "Organização",
    itens: [
      { href: "/", label: "Painel" },
      { href: "/materias", label: "Matérias" },
      { href: "/tarefas", label: "Tarefas" },
      { href: "/cronograma", label: "Cronograma" },
    ],
  },
  {
    titulo: "Estudo",
    itens: [
      { href: "/pomodoro", label: "Pomodoro" },
      { href: "/flashcards", label: "Flashcards" },
      { href: "/notas", label: "Notas" },
    ],
  },
  {
    titulo: "Inteligência",
    itens: [
      { href: "/assistente", label: "Assistente IA" },
      { href: "/estatisticas", label: "Estatísticas" },
      { href: "/integracoes", label: "Integrações" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="logo">
        Estuda<span>Flow</span>
      </div>
      {grupos.map((grupo) => (
        <div key={grupo.titulo}>
          <div className="nav-grupo">{grupo.titulo}</div>
          {grupo.itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${pathname === item.href ? " ativo" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </aside>
  );
}
