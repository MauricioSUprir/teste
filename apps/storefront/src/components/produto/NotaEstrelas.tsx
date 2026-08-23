export function NotaEstrelas({
  nota,
  tamanho = 14,
}: {
  nota: number;
  tamanho?: number;
}) {
  const pct = Math.max(0, Math.min(100, (nota / 5) * 100));
  return (
    <span
      aria-hidden="true"
      className="relative inline-block leading-none align-middle"
      style={{ fontSize: tamanho }}
    >
      <span className="text-linha select-none">★★★★★</span>
      <span
        className="absolute inset-0 overflow-hidden whitespace-nowrap text-alerta select-none"
        style={{ width: `${pct}%`, color: "#E8A317" }}
      >
        ★★★★★
      </span>
    </span>
  );
}
