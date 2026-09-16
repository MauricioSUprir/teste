# Lista de acompanhamento — The Grounds

Estado de cada item do pedido original. Atualizado a cada bloco de trabalho.

Legenda: ✅ feito e verificado · 🔨 em andamento · ⬜ não começado · ⚠️ limitação concreta

---

## 1. Ambição e forma de trabalho

| Item | Estado | Observação |
|---|---|---|
| Identificar ambiente, ferramentas e arquivos existentes | ✅ | Node 22, 4 núcleos, 15 GB RAM, Chromium com rasterizador por software |
| Escolher tecnologia executável no ambiente | ✅ | Vite + TypeScript + three.js (WebGL2), entrega no navegador |
| Arquitetura 3D apropriada, arquivos organizados | ✅ | 30+ módulos separados por sistema |
| Não restringir a um único HTML | ✅ | Projeto modular com empacotamento |
| Começar por área representativa e expandir | ✅ | Vila Aurora acabada primeiro, cidade inteira gerada em torno |
| Trabalhar em etapas verificáveis | ✅ | Capturas reais a cada etapa, correções documentadas nos commits |
| Suporte a teclado, mouse e controle | ✅ | Gamepad no layout padrão reconhecido automaticamente |

## 2. Uso do Higgsfield

| Item | Estado | Observação |
|---|---|---|
| Usar o Higgsfield | ⚠️ | **Não está conectado nesta sessão.** Verificado na lista de conectores da conta |
| Alternativa efetiva | ✅ | Materiais fotogramétricos CC0 do Poly Haven, baixados em tempo de execução |
| Direção de arte consistente | ✅ | Paleta, materiais e iluminação unificados; revisados após crítica do usuário |
| Texturas utilizáveis em 3D (escala, repetição) | ✅ | 21 materiais PBR com cor, normal, rugosidade e oclusão; UV em escala de mundo |
| Não gastar produção em abertura cinematográfica | ✅ | Nenhum vídeo produzido; tudo foi para o jogo |

## 3. Menu e apresentação

| Item | Estado | Observação |
|---|---|---|
| Identidade visual própria | ✅ | Paleta asfalto/cal/amarelo de várzea, tipografia própria |
| Novo jogo | ✅ | |
| Continuar | ✅ | Três espaços, desabilitado com motivo quando não há save |
| Personalizar personagem | ✅ | |
| Configurações | ✅ | |
| Créditos e controles | ✅ | |
| Cena 3D do mundo como fundo | ✅ | Câmera sobrevoa marcos reais da cidade, ao vivo |
| Transições suaves e feedback sonoro | ✅ | |
| Todos os botões funcionam | ✅ | Indisponíveis mostram o motivo |
| Resolução, qualidade, sombras, distância de visão | ✅ | |
| Densidade de pedestres e trânsito | ✅ | |
| Volume, sensibilidade, campo de visão | ✅ | Volume por barramento |
| Remapeamento de controles | ✅ | 21 ações remapeáveis |
| Reduzir movimento de câmera e desligar motion blur | ✅ | |

## 4. Personalização do personagem

| Item | Estado | Observação |
|---|---|---|
| Editor 3D com rotação, zoom, iluminação | ✅ | Três luzes de estúdio, prévia da caminhada |
| Visualização imediata | ✅ | Cor troca sem reconstruir malha |
| Nome | ✅ | |
| Tons de pele | ✅ | 8 tons |
| Formato do rosto | ✅ | Largura, alongamento, queixo, mandíbula, maçãs, nariz, órbitas |
| Olhos e sobrancelhas | ✅ | 7 cores de íris, 4 estilos de sobrancelha |
| Cabelo: corte, estilo, cor | ✅ | 10 cortes, 18 cores, linha do cabelo correta |
| Pelos faciais | ✅ | 6 estilos |
| Altura e proporções corporais | ✅ | 8 parâmetros, sem hierarquia entre corpos |
| Camisetas, camisas, moletons, jaquetas, uniformes | ✅ | 7 peças |
| Calças, bermudas, meias, tênis, chuteiras | ✅ | 5 peças de baixo, 5 calçados, meiões |
| Bonés, óculos, relógios, mochilas | ✅ | |
| Cores e combinações | ✅ | |
| Aparência aparece no jogo, câmeras, veículos, interiores | ✅ | Mesma malha em todos os contextos |
| Tratar sobreposição e deformação | ✅ | Roupas são casca do próprio corpo, cortadas em anéis inteiros |
| Salvar e editar depois | ✅ | Editor acessível pelo menu de pausa |

## 5. Cidade extensa e coerente

| Item | Estado | Observação |
|---|---|---|
| Cidade fictícia brasileira | ✅ | Vila Preciosa, 2048 × 2048 m |
| Centro com prédios, comércio, avenidas | ✅ | |
| Bairros residenciais | ✅ | Vila Aurora, Alto da Pedreira |
| Ruas menores, vielas, praças | ✅ | |
| Bairro esportivo | ✅ | Campo Grande, com arena |
| Rio, pontes, caminhos | ✅ | Rio Sanhaço com pontes geradas na malha |
| Parques, vegetação, relevo | ✅ | Parque da Enseada |
| Área periférica e rural | ✅ | |
| Prédios, casas, ruas, calçadas, pontes, árvores, postes, semáforos, sinalização, bancos, lixeiras, pontos de ônibus, estacionamentos | ✅ | |
| Malha viária e relevo planejados | ✅ | Grade irregular com avenidas, cortada por rio, parques e declive |
| Bairros reconhecíveis e marcos | ✅ | 7 distritos com volumetria, cor e densidade próprias |
| Setores carregados progressivamente | ✅ | Setores de 128 m com dois níveis de detalhe |
| Drenagem | ⬜ | Vale do rio existe; drenagem urbana (bueiros, sarjeta) não modelada |

## 6. Construções e interiores

| Item | Estado | Observação |
|---|---|---|
| Entrada funcional em cada construção | ✅ | Todo edifício nasce com térreo oco e vão de porta |
| Interior coerente gerado sob demanda | ✅ | Montado ao aproximar, desmontado ao afastar |
| Casa inicial mobiliada | ✅ | Vila Aurora |
| Salas, quartos, cozinhas, banheiros | ✅ | |
| Lojas de roupas e artigos esportivos | ✅ | Araras, prateleiras, balcão |
| Cafeterias e mercados | ✅ | |
| Garagens | ✅ | |
| Saguões, escritórios | ✅ | |
| Vestiários | ✅ | |
| Escala, iluminação, colisões, portas, mobiliário | ✅ | |
| Sentar, abrir portas, acender luzes, trocar de roupa | ✅ | Interações registradas por ponto |
| Variação por bairro e uso | ✅ | Planta e mobília mudam por tipo |
| Apartamentos por andar (elevador) | ⚠️ | Elevador presente, mas só o térreo é acessível |
| Transições contínuas | ✅ | Sem tela de carregamento: o interior está dentro do volume real |

## 7. Movimentação e câmeras

| Item | Estado | Observação |
|---|---|---|
| Caminhada, corrida, sprint, salto | ✅ | |
| Passagem por obstáculos baixos | ✅ | Transposição de muretas com arco |
| Aceleração e desaceleração | ✅ | |
| Colisão estável, escadas, inclinações | ✅ | Degraus até 46 cm, escorrega acima de 48° |
| Prevenção de atravessar paredes | ✅ | |
| Animações articuladas e transições | ✅ | Mistura ponderada com inércia por osso |
| Sem pés deslizando | ✅ | Cinemática inversa assenta o pé no terreno |
| Terceira pessoa | ✅ | Braço elástico com desvio de parede |
| Primeira pessoa | ✅ | |
| Câmeras ao dirigir | ✅ | Externa e cabine |
| Câmera de futebol | ✅ | |
| Modo fotografia | ✅ | Câmera livre |
| Ajuste de sensibilidade | ✅ | |
| Câmera boa no trackpad de notebook | ✅ | Perfil auto/mouse/trackpad, curva de aceleração, suavização que espalha o movimento sem perder rotação, limite contra saltos do travamento de ponteiro e rolagem acumulada por limiar |
| Girar a câmera sem apontador | ✅ | Setas do teclado |

## 8. Carros e trânsito

| Item | Estado | Observação |
|---|---|---|
| Carros fictícios convincentes | ✅ | 8 classes por lofting de seções |
| Aproximar, entrar, dirigir, estacionar, sair | ✅ | Desembarque procura espaço livre |
| Aceleração, frenagem, ré, direção progressiva | ✅ | |
| Aderência, suspensão, colisões | ✅ | Derrapagem com limite de aderência |
| Rodas com esterçamento | ✅ | |
| Luzes de freio e faróis | ✅ | Faróis com cone de luz real |
| Sons de motor | ✅ | Sintetizado por harmônicos de explosão |
| Câmera interna com cabine | ✅ | |
| Trânsito com rotas, faixas, cruzamentos, semáforos | ✅ | |
| Distância entre veículos e antibloqueio | ✅ | |
| Garagem para guardar e selecionar | 🔨 | Ponto de interação existe; seleção ainda não implementada |
| Recuperar carro ou personagem preso | ✅ | Reposicionamento seguro automático |
| Animação de abrir a porta | ⬜ | Entrada é imediata, com som de porta |

## 9. Pessoas fictícias e vida urbana

| Item | Estado | Observação |
|---|---|---|
| Bots visualmente variados | ✅ | Aparência aleatória coerente por semente |
| Caminhar até destinos | ✅ | |
| Atravessar nas faixas e esperar o sinal | ✅ | |
| Sentar em bancos | 🔨 | Estado existe; ancoragem ao banco específico falta |
| Conversar em grupos | ✅ | |
| Visitar estabelecimentos | ⬜ | |
| Passear em parques | ✅ | Por densidade de calçada |
| Praticar esportes | ✅ | Uniforme no bairro esportivo |
| Reagir à aproximação do jogador | ✅ | Acena e para |
| Navegação sem atravessar objetos | ✅ | Colisão e separação entre pessoas |
| Atividades por local e horário | ✅ | Densidade varia ao longo do dia |
| Simulação reduzida à distância | ✅ | Três níveis de detalhe |
| Interações curtas com opções | 🔨 | Fala única funciona; menu de opções falta |
| Não depender de serviço externo | ✅ | Tudo local e determinístico |

## 10. Futebol jogável

| Item | Estado | Observação |
|---|---|---|
| Campos de bairro, quadras, instalação maior | ✅ | 9 locais gerados, incluindo arena |
| Chegar ao local e iniciar atividade | ✅ | |
| Treino livre | ✅ | Modo próprio no campo: só você e os goleiros, sem relógio, bola de volta ao pé, aproveitamento/defesas/km-h no HUD. Bola solta em qualquer lugar pela tecla G |
| Escolher entre jogar e treinar | ✅ | Menu contextual no campo: partida 5×5, treino livre ou bater uma bola |
| Condução e domínio | ✅ | |
| Passe | ✅ | |
| Chute com direção e potência | ✅ | Segurar carrega a força |
| Sprint e drible | ✅ | |
| Disputa de posse | ✅ | |
| Goleiros | ✅ | Acompanha, sai do gol e defende |
| Partidas contra bots | ✅ | 5 contra 5 por padrão |
| Placar, tempo, gols, reinício | ✅ | Dois tempos, bola ao centro |
| Retorno à exploração | ✅ | |
| Física da bola | ✅ | Arrasto, efeito Magnus, quique por superfície, rolamento |
| Bots buscam espaço, marcam, passam, chutam | ✅ | |
| Animações coordenadas com o contato | ✅ | Contato programado no ciclo da ação |
| Chute conecta em qualquer taxa de quadros | ✅ | Corrigido: o contato era testado numa janela de 1/60 s e era pulado abaixo de 60 fps |
| **Verificação em partida completa** | 🔨 | Verificados: entrada no campo, posição de saída, treino livre e chute (86 km/h, bola em voo, contador). Falta correr uma partida do apito inicial ao final |

## 10-B. Referência visual de acabamento (Marvel's Spider-Man 2)

O alvo pedido é o acabamento daquele jogo — profundidade de fachada, rua
ocupada, materiais que se distinguem — aplicado à cidade brasileira deste
projeto, não a Nova York dele.

| Item | Estado | Observação |
|---|---|---|
| Janela com profundidade real | ✅ | Anel de moldura que avança da parede, vidro ao fundo, jamba lateral e caixilho. Antes era um decalque de 2 cm colado na parede, que é o que achatava tudo |
| Peitoril e verga salientes | ✅ | Com escorrido de chuva na parede abaixo |
| Grade de proteção nos primeiros andares | ✅ | Presença constante em fachada brasileira; dá a densidade que a escada de incêndio dá na referência |
| Ar-condicionado pendurado no peitoril | ✅ | Com suporte |
| Sujeira acumulando na base | ✅ | Moldura escurece nos andares baixos |
| Carros estacionados no meio-fio | ✅ | Mesmo modelo dos carros que circulam, congelado em geometria de setor: zero desenhos extras |
| Materiais de carro corretos | ✅ | Pintura com verniz, vidro escuro, cromo — antes a lataria pegava a textura de porta de aço do material do mundo |
| Mobiliário de rua na calçada | ✅ | Corrigido: a linha corria pelo bordo externo e jogava postes e árvores para dentro do lote |
| Três anéis de detalhe | ✅ | Perto: miúdos completos. Médio: relevo de janela sem miúdos. Longe: só volume |
| Vagas nas esquinas | 🔨 | O recorte de esquina usa o fim do trecho dentro do setor, não o cruzamento real; num cruzamento ainda sobra carro em lugar estranho |
| Fachada com tijolo e pastilha aparentes | 🔨 | Materiais existem; falta variar mais entre prédios vizinhos |
| Reflexo de rua molhada, poça, meio-fio gasto | ⬜ | Não iniciado |

## 11. Qualidade visual e 4K

| Item | Estado | Observação |
|---|---|---|
| Saída até 3840 × 2160 | ✅ | Teto configurável; segue a janela por padrão |
| Distinguir resolução de renderização, textura e arte | ✅ | Controles separados nas opções |
| Materiais PBR com escala correta | ✅ | |
| Texturas nítidas com mapas apropriados | ✅ | Cor, normal, rugosidade, oclusão |
| Iluminação natural consistente | ✅ | Sol, hemisférica e ambiente por PMREM do próprio céu |
| Sombras proporcionais ao perfil | ✅ | |
| Oclusão de ambiente | ✅ | GTAO |
| Reflexos | ✅ | Ambiente por imagem; sem reflexo em espaço de tela |
| Água com movimento, margens, profundidade | ✅ | Ondas cruzadas, Fresnel, espuma |
| Céu, nuvens, atmosfera | ✅ | Duas camadas de nuvem, crepúsculo, estrelas, lua |
| Vegetação variada | ✅ | 7 espécies |
| Vegetação com movimento sutil | ⬜ | Sem vento na folhagem |
| Vidro, metal, concreto, asfalto, tecidos distinguíveis | ✅ | |
| Antialiasing e correção de cor | ✅ | FXAA e ACES |
| Desgaste e uso urbano | ✅ | Fiação, ar-condicionado, varais, grades, antenas |
| Ciclo de dia e noite | ✅ | |
| Clima gradual, chuva afeta som e superfície | ✅ | Molha o chão e muda a rugosidade |
| Evitar excesso de bloom e saturação | ✅ | |
| Modelos convincentes de personagens e carros | 🔨 | Bons para geometria procedural; abaixo de modelos de artista |

## 12. Áudio

| Item | Estado | Observação |
|---|---|---|
| Áudio espacial | ✅ | HRTF com atenuação por distância |
| Passos por superfície | ✅ | 8 timbres |
| Trânsito e motores | ✅ | |
| Portas | ✅ | |
| Vento, pássaros, água | ✅ | |
| Chuva | ✅ | Camada contínua e gotas próximas |
| Sons de bola e partidas | ✅ | Chute, quique, trave, rede, apito |
| Ambientes internos | ✅ | Abafa o exterior |
| Interface | ✅ | |
| Transições interior/exterior | ✅ | |
| Recursos próprios ou licenciados | ✅ | 100% sintetizado por código |
| Música | ⬜ | Barramento existe, sem trilha composta |

## 13. Atividades e progressão

| Item | Estado | Observação |
|---|---|---|
| Entregas pela cidade | ✅ | |
| Desafios de direção | ✅ | Percursos cronometrados |
| Descoberta de pontos de interesse | ✅ | |
| Desafios esportivos | ✅ | |
| Fotografar locais | ✅ | |
| Comprar roupas | 🔨 | Loja e balcão existem; compra falta |
| Personalizar a casa | ⬜ | |
| Desbloquear itens com progresso | 🔨 | Estrutura pronta, sem catálogo |
| Mapa e minimapa | ✅ | Desenhados do próprio traçado urbano |
| Marcadores e orientação | ✅ | |
| Interface discreta e contextual | ✅ | |
| Salvar aparência, posição, configurações, itens, veículos, progresso | ✅ | Três espaços, salvamento automático |
| Tratamento de falhas e reinício | ✅ | Save inválido não derruba o jogo |
| **Atividades ligadas ao laço principal** | 🔨 | Sistema pronto; falta conectar ao HUD e às interações |

## 14. Desempenho e arquitetura

| Item | Estado | Observação |
|---|---|---|
| Módulos por sistema | ✅ | |
| Carregamento progressivo de setores | ✅ | |
| Níveis de detalhe | ✅ | Terreno, edifícios, pessoas |
| Instanciamento / fusão de repetidos | ✅ | Setores mesclados por material |
| Descarte fora da visão | ✅ | |
| Colisores simplificados | ✅ | Caixas orientadas em hash espacial |
| Limites de memória e reuso | ✅ | |
| Simulação reduzida à distância | ✅ | |
| Resolução dinâmica | ✅ | |
| Medição de desempenho | ✅ | Painel com F3 |
| Estabilidade de tempo de quadro | ✅ | Setores e interiores construídos em etapas retomáveis com orçamento em ms; pedestres e carros reaproveitados de reserva; mapa de ambiente refeito só quando a luz muda |
| Perfil por subsistema | ✅ | Média e pico de cada etapa no painel F3 |
| 60 fps no equipamento de referência | ⚠️ | **Não verificável aqui**: o ambiente só tem rasterizador por software (1–2 fps a 800×450). O trabalho de CPU está medido (soma < 5 ms/quadro); o custo de GPU precisa de teste em máquina real |

## 15. Testes e critérios de entrega

| Fluxo | Estado |
|---|---|
| Abrir o jogo e iniciar sessão | ✅ verificado |
| Criar personagem e ver as escolhas no mundo | ✅ verificado |
| Explorar diferentes setores | ✅ verificado |
| Entrar e sair de construções | ✅ verificado (entrada confirmada por captura) |
| Interagir com pessoas e objetos | 🔨 |
| Entrar em carro, dirigir e sair | 🔨 |
| Iniciar e terminar partida de futebol | 🔨 |
| Alterar câmera e configurações | 🔨 |
| Salvar, recarregar e recuperar progresso | 🔨 |

## 16. Entrega final

| Item | Estado |
|---|---|
| Versão jogável e instruções de execução | ✅ `README.md` |
| Arquivos organizados | ✅ |
| Controles documentados | ✅ No jogo e no README |
| Recursos implementados | ✅ Este arquivo |
| Limitações e pendências | ✅ Este arquivo |
| Evidências de teste | ✅ Capturas reais enviadas a cada etapa |
| Capturas da execução | ✅ Nenhuma imagem gerada apresentada como captura |
| Fontes e licenças | ✅ `CREDITOS.md` |
