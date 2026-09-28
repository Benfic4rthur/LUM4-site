# LUM4 site

Site do LUM4 em português, inglês e espanhol, com identidade da marca, prévia interativa de brilho, apresentação dos modos, download com contador persistente e área de compra.

## Abrir

Com Node.js 20 ou mais recente, execute `npm run dev` nesta pasta e abra **http://127.0.0.1:4178**. Nenhuma instalação de dependências é necessária. `npm run check` verifica a sintaxe.

## Download e compra

Edite `site.config.json`:

- `price`: preço numérico (14.99).
- `currency`: moeda ISO (BRL).
- `downloadUrl`: endereço HTTPS do instalador público.
- `checkoutUrl`: endereço HTTPS de um checkout real.

Também é possível fornecer `LUM4_DOWNLOAD_URL` e `LUM4_CHECKOUT_URL` como variáveis de ambiente. Os links não são enviados ao cliente; as rotas fazem o redirecionamento. Não coloque chaves de pagamento nesta configuração. O site não processa pagamentos nem cria licenças.

Sem links configurados, os botões informam que o endereço de download ou de pagamento ainda não está disponível nesta página. Os links reais precisam ser fornecidos. O preço permanece em reais nos três idiomas; alterar `currency` permite ajustar a moeda, sem conversão automática.

O contador começa em zero e registra **downloads iniciados pelo botão deste site**, quando houver um instalador configurado. É persistido em `data/downloads.json`, com gravação atômica e fila para acessos simultâneos. Não conta visitantes, usuários únicos ou downloads realizados fora do site. Cliques sem instalador e consultas HEAD não incrementam o total. Em hospedagem futura, preservar esse arquivo em armazenamento durável ou migrar o contador para um banco. `LUM4_COUNTER_FILE` permite usar outro caminho persistente.

A integração do contador com os downloads do repositório de releases do LUM4 está adiada, conforme solicitado. A troca de idioma não altera a origem dos dados do contador.

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

Esta entrega é uma prévia local. Não foi publicada e não contém credenciais do repositório privado.

## Versão anterior

A primeira versão, antes do carrossel, dos destaques de IA e dos detalhes de HDR Protection, está preservada em `work/snapshots/lum4-site-v1.tar.gz` para permitir reversão.

A versão aprovada com carrossel e HDR Protection, anterior à passagem de luz, está em `work/snapshots/lum4-site-v2-approved.tar.gz`.
