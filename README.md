# LUM4 site

Site do LUM4 em português, inglês e espanhol, com identidade da marca, prévia interativa de brilho, apresentação dos modos, download e área de compra. A hospedagem pública usa GitHub Pages com o domínio `lum4.app`.

## Abrir

Com Node.js 20 ou mais recente, execute `npm run dev` nesta pasta e abra **http://127.0.0.1:4178**. Nenhuma instalação de dependências é necessária. `npm run check` verifica a sintaxe dos scripts e do gerador estático.

## GitHub Pages

O workflow `.github/workflows/pages.yml` verifica o projeto, gera o site estático e publica a cada envio para `main`. Também pode ser executado manualmente na aba Actions. Em Settings → Pages, a origem da publicação deve ser **GitHub Actions** e o domínio personalizado deve ser `lum4.app`.

`npm run build:pages` prepara `work/pages-site`, que é a única pasta enviada à hospedagem. O gerador copia os arquivos públicos de `dist`, identifica a página como hospedagem estática e inclui `.nojekyll`, `CNAME` e `product.json`. Esse arquivo público contém preço, moeda e links HTTPS válidos fornecidos em `site.config.json`; não inclua credenciais nem links privados nessa configuração. O servidor local, os dados locais e os arquivos de trabalho não são publicados.

Na Hostinger, o domínio aponta para os endereços de GitHub Pages; `www` usa CNAME para `benfic4rthur.github.io`. A opção Enforce HTTPS no GitHub deve ser habilitada quando o certificado do domínio estiver disponível. Referência: [configuração de domínio personalizado no GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

O site publicado usa `product.json` e navega diretamente para os links públicos configurados. A prévia local continua usando `server.mjs` e as rotas `/api/*`. GitHub Pages serve a versão estática sem precisar executar esse servidor.

## Download e compra

Edite `site.config.json`:

- `price`: preço numérico (14.99).
- `currency`: moeda ISO (BRL).
- `downloadUrl`: endereço HTTPS do instalador público.
- `checkoutUrl`: endereço HTTPS de um checkout real.

Na prévia local, também é possível fornecer `LUM4_DOWNLOAD_URL` e `LUM4_CHECKOUT_URL` como variáveis de ambiente; as rotas fazem o redirecionamento. Na versão de GitHub Pages, o gerador lê `site.config.json`, e os links configurados ficam públicos em `product.json`. Não coloque chaves de pagamento nesta configuração. O site não processa pagamentos nem cria licenças.

Sem links configurados, os botões informam que o endereço de download ou de pagamento ainda não está disponível nesta página. Os links reais precisam ser fornecidos. O preço permanece em reais nos três idiomas; alterar `currency` permite ajustar a moeda, sem conversão automática.

O contador do site público será obtido dos downloads do repositório de releases do LUM4. Essa integração fica para depois, conforme solicitado. Até lá, `product.json` usa `downloads: null`, e a versão publicada não apresenta um total de downloads nem faz consultas à API de releases.

A prévia local mantém o mecanismo anterior em `data/downloads.json`, que registra downloads iniciados pela rota local quando há um instalador configurado. Esse arquivo não é enviado ao GitHub Pages e não é a origem do futuro contador público.

## Conteúdo e desempenho

- Manual, Automático, Inteligente e HDR Protection são apresentados como recursos disponíveis, conforme a confirmação do responsável pelo app.
- Os botões PT, EN e ES trocam todo o conteúdo, incluindo a prévia, os modos, os avisos, os rótulos acessíveis e os metadados. Inglês e espanhol têm textos adaptados para cada idioma.
- Português é o padrão. A escolha fica salva apenas no navegador; `?lang=en` e `?lang=es` permitem compartilhar um idioma específico. Bloquear armazenamento não impede a troca de idioma.
- A demonstração usa uma simulação de brilho no navegador e não ativa EDR real.
- Carrossel manual com três cenas: pôr do sol, lago noturno e montanhas claras. Sem rotação automática; cada imagem grande adicional só carrega quando escolhida.
- IA local aparece em destaque, com detalhes sobre correções repetidas, execução pontual e controle do histórico.
- HDR Protection tem explicação própria: redução suave durante HDR, retorno depois e permissão opcional de gravação de tela, sem salvar capturas. Não promete ausência absoluta de perdas nos realces.
- Marca original do app; fotografia criada para a página e comprimida em WebP.
- Fontes do sistema, sem bibliotecas de interface, rastreadores ou serviços externos no carregamento.
- Responsivo, controles por teclado, modais nativos e respeito à preferência de movimento reduzido.
- Entradas suaves ao rolar, uma vez por elemento, usando IntersectionObserver sem dependências. As animações são desativadas com movimento reduzido.
- Uma passagem de luz âmbar percorre a frase “o que importa.” uma vez ao abrir a página, com um halo discreto que desaparece completamente. Dura cerca de três segundos, não roda em loop e respeita movimento reduzido.

Os arquivos publicados não contêm credenciais nem código do repositório privado do aplicativo.

## Versão anterior

A primeira versão, antes do carrossel, dos destaques de IA e dos detalhes de HDR Protection, está preservada em `work/snapshots/lum4-site-v1.tar.gz` para permitir reversão.

A versão aprovada com carrossel e HDR Protection, anterior à passagem de luz, está em `work/snapshots/lum4-site-v2-approved.tar.gz`.
