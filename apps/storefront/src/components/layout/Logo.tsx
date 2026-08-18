/** Logo BeautyNow — símbolo em gota (docs/03 §2), variante rosa (principal). */
export function Logo({ altura = 28, cor = "#E8467C" }: { altura?: number; cor?: string }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ height: altura }}>
      <svg
        viewBox="0 0 32 32"
        width={altura}
        height={altura}
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M16 2 C21.5 10.5 25.5 16.5 25.5 22 a9.5 9.5 0 0 1 -19 0 C6.5 16.5 10.5 10.5 16 2 Z"
          fill={cor}
        />
        <circle cx="13" cy="21" r="3.4" fill="#FFFFFF" opacity="0.85" />
      </svg>
      <span
        className="font-titulo font-semibold leading-none text-tinta"
        style={{ fontSize: altura * 0.78 }}
      >
        Beauty<span style={{ color: cor }}>Now</span>
      </span>
    </span>
  );
}
