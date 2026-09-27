# ARES — Sobrevivência em Marte (documento de design v0.1)

Plataforma: web (Three.js r17x + Rapier3D WASM), Vite, TypeScript. PC (teclado/mouse, pointer lock) e celular (joystick virtual, toque), qualidade adaptativa.
Idiomas: PT-BR (padrão), EN, ES, FR — trocáveis no menu a qualquer momento.

## Mundo
- Terreno 2 km x 2 km (heightfield 1025² + detalhe em shader), gerado a partir de morfologia marciana real: crateras com borda elevada e ejecta (lei de potência de tamanho), dunas eólicas, planícies com rochas espalhadas (distribuição de tamanho tipo Golombek), camadas sedimentares. Semente fixa → mundo idêntico entre sessões.
- Texturas PBR Poly Haven (CC0) recoloridas para o espectro marciano + triplanar + mistura por inclinação/altura; normal/roughness/AO; displacement em perto.
- Gravidade 3,721 m/s². Atmosfera 610 Pa, CO2 95%.

## Sol, céu, luz
- Posição do sol calculada pelo algoritmo Mars24 (NASA GISS) para a latitude do local (Jezero, 18,4°N) — sol de 24h39m35s, acelerado no jogo (1 sol = 40 min reais, ajustável).
- Diâmetro angular do sol 0,35° (vs 0,53° na Terra), irradiância 590 W/m² (43% da Terra).
- Céu com espalhamento por poeira: dia cor caramelo/butterscotch, pôr do sol azulado em volta do sol (espalhamento de Mie direto da poeira), noite com Fobos e Deimos e estrelas.
- Sombras em cascata (CSM, 4 cascatas, 4096²), sombras suaves, AO em tela (N8AO/GTAO), bloom, tonemapping AgX/ACES, névoa de poeira dependente da altura e da opacidade (tau) da atmosfera, exposição automática.

## Jogador
- Astronauta em traje EVA. Primeira e terceira pessoa alternáveis (V). Câmera 3ª pessoa com colisão.
- Controlador cinemático Rapier com gravidade marciana: saltos altos e longos (~2,7x altura da Terra), inércia, derrapagem em declive, dano por queda.
- Traje: O2, CO2 absorvido, água, calorias, bateria, temperatura interna, dose de radiação (mSv), integridade do traje, saúde.

## Sobrevivência
- O2 consumido ~0,84 kg/dia; água ~3 kg/dia; ~2500-3000 kcal/dia; bateria do traje alimenta aquecedor (noite -80 °C) e suporte de vida.
- Recursos: gelo subterrâneo (perfurar), regolito, sucata/metal de destroços da nave, peças eletrônicas, sementes de batata.
- Construção: habitat (pressurizado, recarrega traje), painel solar, bateria, MOXIE (O2 a partir de CO2), extrator de água (gelo→água), estufa (batatas), antena de rádio (objetivo final: contatar a Terra e sobreviver até resgate).
- Energia solar depende do ângulo do sol, da hora e da poeira (tau) + acúmulo de poeira nos painéis (limpar).
- Tempestades de poeira: tau sobe de 0,5 para 3–5, céu escurece, visibilidade cai, vento empurra partículas (a pressão baixa quase não empurra o jogador – realista), energia solar despenca.
- Radiação: ~0,67 mSv/dia na superfície; eventos solares (SPE) exigem abrigo.

## Rover
- Rapier DynamicRayCastVehicleController, 6 rodas, suspensão, torque, freio, capotagem. Bateria, faróis, entrar/sair (F).

## Missões (história curta)
Queda da nave → recuperar suprimentos → montar habitat → energia → oxigênio → água → comida → reparar antena → sobreviver até o resgate (sol 30). Voz da IA do traje "ARES" (ElevenLabs) nos 4 idiomas.

## Som
Vento marciano fino (atmosfera rarefeita abafa sons: som dentro do capacete dominante), respiração, passos por condução, alarmes, voz ARES.

## Interface
HUD minimalista estilo visor do capacete, bússola, barras vitais, mensagens. Menu: idiomas, qualidade (Auto/Baixa/Média/Alta/Ultra/Máxima), escala de resolução até nativa 4K, sensibilidade, inverter Y, FOV, volume. Salvamento automático (localStorage).

## Celular
Joystick esquerdo, arrastar à direita para olhar, botões pular/interagir/construir/câmera, orientação paisagem, escala de resolução dinâmica pelo FPS.
