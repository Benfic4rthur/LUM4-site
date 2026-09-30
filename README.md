# LUM4 site

Site do LUM4 em português, inglês e espanhol, com identidade da marca, prévia interativa de brilho, apresentação dos modos, download e área de compra. A hospedagem pública usa GitHub Pages com o domínio `lum4.app`.

## Abrir

Com Node.js 22 ou mais recente, execute `npm run dev` nesta pasta e abra **http://127.0.0.1:4178**. Nenhuma instalação de dependências é necessária. `npm run check` verifica a sintaxe; `npm run test:security` testa a publicação, os caminhos do servidor e respostas atrasadas de compra em ambientes isolados, sem pedidos ou pagamentos reais.

## GitHub Pages

O workflow `.github/workflows/pages.yml` verifica o projeto, gera o site estático e publica a cada envio para `main`. Também pode ser executado manualmente na aba Actions. Em Settings → Pages, a origem da publicação deve ser **GitHub Actions** e o domínio personalizado deve ser `lum4.app`.

`npm run build:pages` prepara `work/pages-site`, que é a única pasta enviada à hospedagem. `public-files.mjs` permite apenas os arquivos da página e imagens em `assets`; o build falha diante de arquivos ocultos, backups, links simbólicos ou tipos inesperados. O gerador identifica a página como hospedagem estática e inclui `.nojekyll`, `CNAME` e `product.json`. Esse arquivo público contém preço, moeda e links HTTPS válidos fornecidos em `site.config.json`; não inclua credenciais nem links privados nessa configuração. O servidor local, os dados locais e os arquivos de trabalho não são publicados. As actions do workflow estão fixadas por SHA, com credenciais de checkout descartadas e testes antes da publicação. Para atualizar as actions, confirme o commit na origem oficial de cada uma.

Na Hostinger, o domínio aponta para os endereços de GitHub Pages; `www` usa CNAME para `benfic4rthur.github.io`. A opção Enforce HTTPS no GitHub deve ser habilitada quando o certificado do domínio estiver disponível. Referência: [configuração de domínio personalizado no GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

O download navega diretamente para o GitHub Releases pelo link permanente no HTML, tanto na prévia quanto no site publicado. Funciona sem JavaScript e independentemente das consultas de produto e compra. `product.json` publica a mesma URL; a prévia local continua usando `server.mjs` para os demais dados e rotas `/api/*`. GitHub Pages serve a versão estática sem precisar executar esse servidor.

## Download e compra

Edite `site.config.json`:

- `price`: preço de compatibilidade da licença individual (14.99); `plans` tem prioridade.
- `currency`: moeda ISO (BRL).
- `downloadUrl`: link permanente `https://github.com/Benfic4rthur/LUM4-Releases/releases/latest/download/LUM4-macOS-arm64.dmg`. O GitHub redireciona para o asset da release marcada como latest. Mantenha o mesmo nome de arquivo em cada release; não é necessário editar o site a cada publicação.
- `plans`: opções com `devices`, `price` e `checkoutUrl`. Os valores atuais são 1 Mac por R$ 14,99, 2 Macs por R$ 23,99 e 3 Macs por R$ 29,99. Cada pacote precisa de seu próprio endereço HTTPS de checkout.
- `checkoutUrl`: endereço de compatibilidade para a licença de 1 Mac, usado quando essa opção não tem link próprio.

Na prévia local, `LUM4_CHECKOUT_URL` é o link de compatibilidade da opção de 1 Mac. A rota de compra usa `?devices=1`, `2` ou `3` para redirecionar ao checkout do pacote selecionado. A rota legada `/api/download` redireciona para o mesmo endereço configurado, mas os botões não dependem dela. Na versão de GitHub Pages, o gerador lê `site.config.json`, e os links configurados ficam públicos em `product.json`. O DMG permanece no GitHub Releases: não é copiado para o site nem para Artifact Storage. Não coloque chaves de pagamento nesta configuração. O site não processa pagamentos nem cria licenças.

O cartão permite selecionar o número de Macs. A economia do pacote de 3 Macs é calculada em centavos, comparando seu preço com três licenças individuais: R$ 44,97 − R$ 29,99 = R$ 14,98, aproximadamente 33%. O destaque e os valores acompanham a configuração e o idioma escolhido.

Ao passar o mouse sobre um pacote, ele sobe 4 pixels e recebe uma borda e um brilho âmbar suaves. O efeito usa apenas CSS e respeita movimento reduzido; a seleção da licença permanece independente do destaque do mouse.

O download é público e não exige login no GitHub. A compra atual consulta os planos, cupons públicos e estatísticas de `https://lum-4-license-server.vercel.app`. Após o usuário enviar o formulário, essa API cria o Pix e informa a confirmação/licença; o preço e a autorização de pagamento precisam ser validados no servidor. A configuração local mantém valores e redirecionamentos de compatibilidade. Se os planos da API estiverem indisponíveis, a compra fica desabilitada e o download continua independente. Fechar ou reabrir a compra cancela as consultas anteriores; respostas e animações de sessões antigas não substituem o Pix ou a licença atuais.

Ao iniciar um download, o site expande as instruções de primeira abertura logo abaixo do botão, sem interromper o link direto. O usuário também pode abrir o aviso antes de baixar. Sem JavaScript, as instruções ficam expandidas. O texto informa que a versão atual ainda não foi autenticada pela Apple e orienta a autorização em Privacidade e Segurança, com referência ao suporte da Apple. A alternativa no Terminal mostra o comando fornecido pelo responsável pelo app, restrito a `/Applications/LUM4.app`, com opção de copiar; o site não executa o comando. O aviso e as instruções estão disponíveis em português, inglês e espanhol.

O contador consulta, no navegador, a API pública do GitHub para `Benfic4rthur/LUM4-Releases`. Ele percorre as páginas de 100 releases e soma o `download_count` dos assets `.dmg` de todos os releases públicos, incluindo pré-lançamentos; arquivos `.sha256` ficam excluídos. O total representa downloads, não usuários únicos. A origem dos dados é documentada nos [endpoints de releases da API do GitHub](https://docs.github.com/en/rest/releases/releases).

A consulta é independente da API de compra. O navegador guarda o último total válido no `localStorage`, com cache de cinco minutos, e atualiza a cada cinco minutos enquanto a aba está visível. Se uma consulta falhar, preserva o último total válido ou disponível em cache, sem substituir o resultado por um zero inventado. A API tem [limites para consultas sem autenticação](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), e o número exibido pode ficar atrasado por cache ou erro de consulta.

A prévia local ainda mantém a rota de download e o arquivo legado `data/downloads.json`, que registra downloads iniciados por essa rota quando há um instalador configurado. Esse arquivo não é enviado ao GitHub Pages e não alimenta o contador da interface.

## Conteúdo e desempenho

A capa de compartilhamento é renderizada de `scripts/share-card.html` em 1200 × 630. O símbolo vem da arte original em `scripts/brand-reference.png`, enquadrada em tamanho nativo; não é um redesenho nem uma ampliação do ícone de 64 pixels usado no cabeçalho. Cabeçalho e conteúdo usam a marca original de `dist/assets/lum4-mark.png`. Os favicons v4 derivam da imagem de ícone enviada pelo responsável, com o fundo externo removido e os cantos arredondados preservados; a fonte transparente está em `scripts/lum4-icon-source-v4.png`. As versões PNG têm 16, 32, 64, 128 e 256 pixels; `node scripts/build-favicon.mjs` reúne os PNGs em `favicon-v4.ico` e atualiza o endereço convencional `favicon.ico`. Favoritos e atalhos também têm o ícone de 180 pixels. Novos nomes de arquivo permitem distinguir os ícones da versão antiga em cache. Ao trocar a capa, use um novo nome no `og:image` e `twitter:image` para distinguir a versão publicada.

- Manual, Automático, Inteligente e Video Detail Protection são apresentados como recursos disponíveis, conforme a confirmação do responsável pelo app.
- Os botões PT, EN e ES trocam todo o conteúdo, incluindo a prévia, os modos, os avisos, os rótulos acessíveis e os metadados. Inglês e espanhol têm textos adaptados para cada idioma.
- Português é o padrão. A escolha fica salva apenas no navegador; `?lang=en` e `?lang=es` permitem compartilhar um idioma específico. Bloquear armazenamento não impede a troca de idioma.
- A demonstração usa uma simulação de brilho no navegador e não ativa EDR real.
- Carrossel manual com três cenas: pôr do sol, lago noturno e montanhas claras. Sem rotação automática; cada imagem grande adicional só carrega quando escolhida.
- IA local aparece em destaque, com detalhes sobre correções repetidas, execução pontual e controle do histórico.
- Turbo Boost tem seção própria com escala ilustrativa de até 3,2×, comparada ao teto padrão de 2,5×. A seção informa o nome Ultra Boost usado no app, a ativação, o ajuste manual e a recomendação de uso temporário. O resultado depende da capacidade EDR disponível da tela; os multiplicadores não são uma medição de luminância.
- Video Detail Protection tem explicação própria: quando o macOS indica reprodução de vídeo, o LUM4 reduz temporariamente o Boost XDR para 50% do valor escolhido, ajudando a preservar detalhes da imagem, e restaura o valor anterior ao terminar. O recurso não captura nem analisa a imagem da tela.
- A nota sobre a tela explica o uso de EDR nativo e os limites de hardware. Os detalhes ficam recolhidos para manter a página leve, com links à Apple sobre [EDR](https://developer.apple.com/videos/play/wwdc2021/10161/) e [limitação de brilho em temperaturas elevadas](https://support.apple.com/en-us/101865). O mecanismo do app foi conferido: renderização Metal/EDR e teto baseado na capacidade potencial informada por `NSScreen`. Isso não é uma certificação da Apple nem uma garantia de ausência de desgaste; o texto também informa que brilho intenso pode aumentar o consumo de energia.
- Marca original do app; fotografia criada para a página e comprimida em WebP.
- Fontes do sistema, sem bibliotecas de interface ou rastreadores; os dados de compra são consultados na API de licenças.
- Responsivo, controles por teclado, modais nativos e respeito à preferência de movimento reduzido.
- Abertura em etapas suaves no cabeçalho, texto e prévia, repetida a cada carregamento. Os elementos abaixo aparecem uma vez conforme a rolagem, usando IntersectionObserver sem dependências. Os efeitos usam opacidade e pequenos deslocamentos, respeitam movimento reduzido e mantêm o acesso por teclado.
- Uma passagem de luz âmbar percorre a frase “o que importa.” uma vez ao abrir a página, com um halo discreto que desaparece completamente. Dura cerca de três segundos, não roda em loop e respeita movimento reduzido.

Os arquivos publicados não contêm credenciais nem código do repositório privado do aplicativo.

## Segurança e limites

O HTML aplica CSP com scripts e estilos locais, sem JavaScript/estilos inline, sem plugins, frames internos, envio nativo de formulários ou alteração de URL base. As conexões ficam restritas à própria origem e à API de licenças. `no-referrer` evita compartilhar URLs ao navegar para outro serviço. A mensagem do console é apenas uma brincadeira e não controla acesso nem bloqueia DevTools.

O rodapé publica o contato `suporte@allm4.com` com link `mailto:` e rótulo nos três idiomas. Abrir o link prepara o contato no aplicativo de e-mail do visitante; o site não envia mensagens automaticamente.

O servidor de prévia atende em `127.0.0.1` por padrão, rejeita caminhos fora da lista pública e symlinks, limita métodos a GET/HEAD e adiciona CSP, `nosniff`, bloqueio de enquadramento e Permissions-Policy. Esses cabeçalhos do servidor local não são enviados pelo GitHub Pages. Na hospedagem pública, `frame-ancestors`, X-Frame-Options, nosniff e Permissions-Policy precisam de uma camada HTTP configurável; não funcionam como substitutos em tags meta. HTTPS obrigatório está habilitado no Pages. A CSP em meta já vale na página pública.

A auditoria de 30/09/2026 não comprovou invasão ou bypass de pagamento. Permanecem pontos de administração: proteger `main`, confirmar a verificação do domínio na conta GitHub e habilitar alertas de dependências. A API de licenças tem escopo próprio: confirmar proteção contra excesso de requisições, rejeição de webhooks antes de gravar payloads e validação de certificado do banco. A revisão de fonte e as consultas públicas não constituem um teste de invasão nem uma garantia de segurança absoluta.

## Versão anterior

A primeira versão, antes do carrossel, dos destaques de IA e da proteção de vídeo, está preservada em `work/snapshots/lum4-site-v1.tar.gz` para permitir reversão.

A versão histórica aprovada com a proteção anterior, antes do Video Detail Protection e da passagem de luz, está em `work/snapshots/lum4-site-v2-approved.tar.gz`.
