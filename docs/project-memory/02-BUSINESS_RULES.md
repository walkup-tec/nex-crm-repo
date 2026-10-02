# Regras de negócio

- Papéis ficam em tabela própria: `master`, `client_admin`, `client_user`.
- Cada usuário de cliente pertence a uma organização. O Master enxerga todas.
- Cliente consulta campanhas. Não cria, edita, ativa nem pausa campanha.
- Financeiro: aviso nos dias 1 a 3 de atraso; bloqueio não interativo a partir do 4º dia.
- Criativos: cliente consulta e baixa. Master envia, move, renomeia e exclui.
- Sem credencial real de Meta, Asaas ou EVO, a tela mostra o estado de conexão. Não há chamada a endpoint fictício nem confirmação de pagamento real.
