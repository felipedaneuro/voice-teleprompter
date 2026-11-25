# Teleprompter com rolagem por voz

Teleprompter web em HTML, CSS e JavaScript puros, sem dependências. No modo **voz** ele acompanha a sua leitura pelo microfone como um karaokê: a palavra atual fica destacada e o texto só sobe depois que você a leu. Se você pausar ou improvisar, ele espera.

## Como rodar

O navegador só libera o microfone em `localhost` ou `https`, então sirva a pasta com um servidor local:

```bash
cd ~/Projects/teleprompter && python3 -m http.server 5173
```

Depois abra http://localhost:5173 no **Chrome**, **Edge** ou **Safari**.

> O Firefox não tem a Web Speech API: nele só o modo automático funciona. No Chrome o reconhecimento de voz é processado pelo serviço do Google e precisa de internet.

## Funcionalidades

- **Roteiro em Markdown**: títulos, **negrito**, *itálico*, listas, citações e `---` (pausa visual). Texto entre `[colchetes]` vira nota de direção, que aparece destacada e não precisa ser lida. Importa `.md`/`.txt` e salva automaticamente no navegador.
- **Modo voz (karaokê)**: alinha o que o microfone ouve com o roteiro, tolerando acentos, pontuação, palavras parciais e pequenos erros de reconhecimento.
- **Modo automático**: velocidade constante com ajuste fino de 0,1 em 0,1 e estimativa de palavras por minuto.
- **Tipografia**: tamanho da fonte, espaçamento entre linhas, margens laterais, família e peso da fonte.
- **Contraste**: branco, amarelo ou verde sobre preto, creme sobre grafite e preto sobre branco. A opacidade do texto já lido é ajustável.
- **Guia de leitura**: faixa e/ou setas com posição vertical ajustável, para manter os olhos perto da lente.
- **Contagem regressiva** configurável de 0 a 10 s.
- **Espelhamento** horizontal e vertical (para vidro beam-splitter), **tela cheia** e interface clara/escura.
- Barra de progresso, tempo restante estimado e indicador do microfone.

## Atalhos

| Tecla | Ação |
|---|---|
| Espaço | Iniciar / pausar |
| ↑ / ↓ | Velocidade ±0,1 |
| ← / → | Parágrafo anterior / próximo |
| + / − | Tamanho da fonte |
| R | Voltar ao início |
| E | Editar roteiro |
| M | Espelhar |
| F | Tela cheia |
| Esc | Parar / fechar ajustes |
| Clique numa palavra | Continuar a partir dela |
| Roda do mouse | Reposicionar manualmente |

## Estrutura

```
index.html          interface
styles.css          temas, paletas e layout
js/app.js           controlador (estado, eventos, HUD)
js/markdown.js      parser de Markdown → spans por palavra
js/voice-tracker.js reconhecimento de voz + alinhamento com o roteiro
js/scroller.js      rolagem suave por requestAnimationFrame
js/karaoke.js       destaque de palavras lidas / atual
js/settings.js      preferências (localStorage) e variáveis CSS
js/countdown.js     contagem regressiva
js/pace-meter.js    palavras por minuto em tempo real
js/keyboard.js      atalhos de teclado
js/text-utils.js    normalização e comparação tolerante de palavras
```
