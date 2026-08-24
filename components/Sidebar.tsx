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
      { href: "/calendario", label: "Calendário" },
      { href: "/cronograma", label: "Cronograma" },
    ],
  },
  {
    titulo: "Estudo",
    itens: [
      { href: "/pomodoro", label: "Pomodoro" },
      { href: "/flashcards", label: "Flashcards" },
      { href: "/estudar", label: "Modos de estudo" },
      { href: "/notas", label: "Notas" },
    ],
  },
  {
    titulo: "Inteligência",
    itens: [
      { href: "/assistente", label: "Assistente IA" },
      { href: "/estatisticas", label: "Estatísticas" },
      { href: "/notificacoes", label: "Notificações" },
      { href: "/integracoes", label: "Integrações" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  // A tela de senha não mostra a navegação
  if (pathname === "/entrar") return null;

  return (
    <aside className="sidebar">
      <div className="logo" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" width={30} height={30} />
        <span style={{ color: "var(--tinta)" }}>
          Pul<span style={{ color: "var(--acento)" }}>so</span>
        </span>
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
