# Plano de implementação — NEX Ads

## Objetivo
Construir a aplicação SaaS multiempresa completa da NEX Marketing Digital, em português do Brasil, com área do cliente e área Master separadas, autenticação segura, dados demonstrativos claramente identificados e integrações reais preparadas para Meta, Asaas e EVO API sem simular operações externas indisponíveis.

## Identidade e experiência
- Aplicar a paleta oficial `#010317`, `#6F02FD`, `#00EAFD` e branco em um visual fintech/SaaS sofisticado, com gradientes pontuais e sem excesso de neon ou glassmorphism.
- Usar o logo que ainda será anexado; manter uma marca tipográfica provisória somente durante o desenvolvimento se necessário.
- Criar Light Mode como padrão e Dark Mode com preferência individual persistente.
- Construir mobile-first, reorganizando tabelas, indicadores, menus, gráficos e ações para toque; sem PWA.
- Criar estados de carregamento, vazio, erro, sucesso, offline, dados desatualizados, sincronização, pagamento e transferência de arquivos.

## Fundação segura e dados
- Ativar o Lovable Cloud para autenticação, banco, armazenamento privado e funções seguras.
- Modelar organizações, perfis, papéis separados, permissões, contas Meta, campanhas e métricas sincronizadas, contratos, cobranças, alertas, templates, criativos, pastas e auditoria.
- Aplicar isolamento por organização e regras de acesso no servidor e no banco; Master terá acesso global auditado, Cliente Principal administrará sua organização e Usuário Adicional seguirá permissões individuais.
- Implementar e-mail e senha, primeiro acesso seguro, recuperação de senha, bloqueio e logout; sem 2FA.
- Incluir dados demonstrativos realistas em seed separado, identificados na interface e substituíveis pelos conectores reais.

## Área do cliente
- Criar navegação para Visão Geral, Campanhas, Créditos Meta, Financeiro, Criativos, Usuários e Minha Conta, ocultando itens sem permissão.
- Visão Geral: conta(s) Meta, período, atualização, saldo, KPIs, comparativos e gráfico de resultados por campanha com custo por resultado.
- Campanhas: filtros combináveis, visão responsiva e detalhes somente leitura; nenhuma ação de criação, edição, ativação ou pausa.
- Créditos Meta: valor livre e fluxo preparado para QR Code/Pix, bloqueado com mensagem transparente até existir endpoint autorizado.
- Financeiro: mensalidade, atraso, histórico, documentos e Pix; banner nos dias 1–3 e bloqueio não interativo a partir do 4º dia.
- Criativos: navegação por pastas, seleção, preview de imagem/vídeo/PDF e downloads; cliente somente consulta e baixa.
- Usuários: Cliente Principal cria, edita, bloqueia e exclui adicionais, exceto a própria conta, com permissões de saldo e crédito.

## Área Master
- Dashboard operacional com clientes ativos, atrasados, bloqueados, contratos, recebíveis e saldos críticos.
- Clientes com abas Ativos/Inativos, cadastro completo com máscaras durante digitação, detalhes, contrato, contas Meta, financeiro e desativação.
- Modo de suporte seguro para visualizar como cliente, com faixa persistente, retorno ao Master e auditoria.
- Financeiro global, negociação por cobrança com remoção pontual de juros/multa e trilha de auditoria.
- Gerenciador de criativos por cliente com pastas/subpastas, upload direto e seguro, mover, renomear, excluir, preview e download em lote.
- Configurações de multa/juros, conectores e templates de WhatsApp com validação de variáveis.

## Integrações preparadas
- Meta Marketing API: serviço isolado, cache/sincronização horária, atualização manual protegida, paginação, limites, retries e expiração; tokens somente no servidor.
- Asaas: serviço central para clientes, cobranças mensais, Pix, cancelamento e webhook assinado/idempotente; webhook será a fonte de verdade.
- EVO API: serviço central para alertas financeiros, deduplicação por faixa/ciclo e registro de tentativas.
- Enquanto não houver credenciais, apresentar estados de conexão e demonstração; não chamar endpoints fictícios nem afirmar pagamentos reais.

## Qualidade e validação
- Formatação PT-BR para CPF/CNPJ, telefone, moeda, percentual, datas e fuso horário.
- Componentes acessíveis, foco visível, teclado, contraste, labels e suporte a movimento reduzido.
- Carregamento eficiente, cache, paginação e thumbnails; uploads não passam arquivos grandes integralmente pela memória.
- Cobrir os 18 cenários obrigatórios do documento, incluindo múltiplas contas, faixas de saldo, inadimplência, permissões, isolamento, indisponibilidade e webhooks duplicados.
- Validar os fluxos principais em desktop e smartphone e revisar erros antes da entrega.

## Detalhes técnicos
- TanStack Start com rotas públicas de autenticação e páginas protegidas separadas para cliente e Master.
- Funções de servidor com validação de entrada; webhooks públicos verificados; serviços externos desacoplados por interfaces.
- Armazenamento privado com caminhos por organização, URLs temporárias e políticas de acesso.
- Papéis em tabela própria e permissões verificadas no servidor; nenhuma credencial ou decisão financeira confiada ao navegador.
- Cada página terá metadados próprios e o código será dividido por domínio para facilitar evolução posterior.

## Dependências antes da conclusão
- Receber o arquivo visual do logo NEX (PNG, SVG ou WEBP).
- Credenciais da Meta, Asaas e EVO API não estão disponíveis agora; os conectores serão preparados e permanecerão desativados até serem fornecidos com segurança.
