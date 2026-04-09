"""Calculadora simples em Python - Demonstração do Claude Code."""


def somar(a: float, b: float) -> float:
    return a + b


def subtrair(a: float, b: float) -> float:
    return a - b


def multiplicar(a: float, b: float) -> float:
    return a * b


def dividir(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("Divisão por zero não é permitida")
    return a / b


def calcular(operacao: str, a: float, b: float) -> float:
    operacoes = {
        "+": somar,
        "-": subtrair,
        "*": multiplicar,
        "/": dividir,
    }
    if operacao not in operacoes:
        raise ValueError(f"Operação '{operacao}' não suportada. Use: +, -, *, /")
    return operacoes[operacao](a, b)


if __name__ == "__main__":
    print("=== Calculadora ===")
    print(f"2 + 3 = {calcular('+', 2, 3)}")
    print(f"10 - 4 = {calcular('-', 10, 4)}")
    print(f"5 * 6 = {calcular('*', 5, 6)}")
    print(f"15 / 3 = {calcular('/', 15, 3)}")
