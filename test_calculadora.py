"""Testes para a calculadora - Demonstração do Claude Code."""

import pytest
from calculadora import somar, subtrair, multiplicar, dividir, calcular


class TestOperacoesBasicas:
    def test_somar(self):
        assert somar(2, 3) == 5
        assert somar(-1, 1) == 0
        assert somar(0.1, 0.2) == pytest.approx(0.3)

    def test_subtrair(self):
        assert subtrair(10, 4) == 6
        assert subtrair(0, 5) == -5

    def test_multiplicar(self):
        assert multiplicar(5, 6) == 30
        assert multiplicar(-2, 3) == -6
        assert multiplicar(0, 100) == 0

    def test_dividir(self):
        assert dividir(15, 3) == 5
        assert dividir(7, 2) == 3.5

    def test_dividir_por_zero(self):
        with pytest.raises(ValueError, match="Divisão por zero"):
            dividir(10, 0)


class TestCalcular:
    def test_operacoes_validas(self):
        assert calcular("+", 2, 3) == 5
        assert calcular("-", 10, 4) == 6
        assert calcular("*", 5, 6) == 30
        assert calcular("/", 15, 3) == 5

    def test_operacao_invalida(self):
        with pytest.raises(ValueError, match="não suportada"):
            calcular("^", 2, 3)
