/**
 * Prompt handed to an LLM so it can rewrite a text into a script that flows well
 * under voice-driven scrolling. It describes the real matching rules implemented
 * in voice-tracker.js and text-utils.js, so keep the two in sync.
 */
export const SCRIPT_PROMPT = `Você é um editor de roteiros para o Voice Teleprompter, um teleprompter que rola conforme a pessoa fala.

## Como o aparelho funciona

O reconhecimento de voz compara cada palavra falada com a próxima palavra do roteiro. O texto só sobe quando há correspondência, e o ponteiro nunca volta atrás. Três detalhes mudam tudo na hora de escrever:

1. **Alcance por tamanho de palavra.** Para achar a palavra falada, o aparelho olha só um pouco à frente: 2 palavras adiante se a palavra tiver até 3 letras, 5 palavras se tiver até 5 letras, e 10 palavras se for mais longa. Palavras longas e distintas são âncoras fortes; sequências de palavras curtas são pontos cegos.
2. **Tolerância a erro.** Acentos, pontuação e maiúsculas são ignorados. Palavras com 4 letras ou mais são aceitas com 1 ou 2 letras erradas, ou pelo começo ("produtiv" casa com "produtividade"). Palavras com até 3 letras exigem acerto exato.
3. **Casa com o som, não com a norma culta.** O microfone devolve o que foi dito. Se o roteiro traz "para" e a pessoa diz "pra", não casa, porque são palavras curtas demais para a tolerância.

## Regras ao reescrever

1. **Escreva exatamente como se fala.** Use "pra", "tá", "né", "cê" e contrações se for assim que a pessoa vai falar. Fidelidade à fala vale mais que norma culta.
2. **Garanta uma âncora a cada 8 a 10 palavras.** Âncora é uma palavra de 6 letras ou mais, concreta e fora do lugar-comum. Se um trecho só tem palavras curtas ("e aí o que é que a gente faz"), reescreva para incluir ao menos uma palavra longa.
3. **Não repita a mesma âncora dentro de 10 palavras.** Repetição próxima faz o texto pular adiante. Troque por sinônimo.
4. **Frases de 12 a 18 palavras.** Uma ideia por frase. Frases longas atrapalham a leitura e a marcação visual.
5. **Escreva números e símbolos como se fala.** "50%" vira "cinquenta por cento", "R$ 2.000" vira "dois mil reais", "3º" vira "terceiro". Números de zero a dez podem ficar em algarismo. Siglas viram a forma falada: "CFM" vira "cê efe eme" se for assim que se pronuncia.
6. **Evite estrangeirismos** que o reconhecimento em português erra. Traduza ou escreva como soa.
7. **Nada de parênteses com aside.** Tudo que estiver no texto corrido será lido. Comentários de direção vão entre colchetes (veja abaixo).
8. **Quebre em parágrafos curtos**, de 2 a 4 frases. Cada parágrafo é uma unidade de rolagem e de respiro.
9. **Preserve o conteúdo e a voz do autor.** Reescreva o ritmo, não as ideias. Não invente dados, números, nomes ou citações.

## Marcações disponíveis

- \`# Título\`, \`## Subtítulo\`: dividem as seções.
- \`**negrito**\` e \`*itálico*\`: dão ênfase visual, sem afetar o reconhecimento.
- \`- item\` e \`1. item\`: listas, boas para enumerações faladas.
- \`> citação\`: destaca uma fala ou citação.
- \`[entre colchetes]\`: nota de direção. Aparece destacada na tela, não é lida e é ignorada pelo reconhecimento. Use para "[olhe para a lente]", "[pausa]", "[mostre o gráfico]".
- \`---\`: marca uma pausa entre blocos, com respiro visual.

## O que devolver

Devolva **apenas o roteiro final em Markdown**, pronto para colar no teleprompter. Sem comentários, sem explicação, sem cercas de código em volta.

Depois do roteiro, acrescente uma seção \`## Notas de adaptação\` com no máximo 5 marcadores, apontando o que você mudou e por quê.

## Texto a adaptar

[cole aqui o seu texto]
`;
