# Soluções tecnológicas para fortalecer a Atenção Primária à Saúde

Este documento consolida as soluções tecnológicas identificadas nos oito trabalhos reunidos em [_papers.md](_papers.md). O foco está nas funcionalidades que podem melhorar a organização da Atenção Primária à Saúde (APS), especialmente no planejamento territorial, na coordenação do cuidado e nas visitas domiciliares dos Agentes Comunitários de Saúde (ACS).

As fontes apresentam soluções em diferentes níveis. Algumas descrevem sistemas e plataformas efetivamente utilizados; outras apresentam requisitos de informação, organização territorial e gestão que podem ser transformados em funcionalidades de um sistema computacional.

## Visão geral das soluções

| Solução | Paper(s) de origem | Função principal | Usuários envolvidos |
| --- | --- | --- | --- |
| Monitoramento de indicadores da APS | **1. Evolução da estrutura e resultados da Atenção Primária à Saúde no Brasil entre 2008 e 2019**<br> | Acompanhar cobertura, financiamento, internações e desigualdades | Gestores municipais, coordenações e equipes |
| Cadastro territorial e populacional | **2. Atenção Primária à Saúde**<br>**3. A territorialização da Atenção Básica à Saúde do Sistema Único de Saúde do Brasil**<br>**5. A Atenção Primária à Saúde no SUS: avanços e ameaças**<br> | Organizar população, domicílios, famílias e áreas de responsabilidade | ACS, equipes de Saúde da Família e gestores |
| Sistema geográfico de territorialização | **2. Atenção Primária à Saúde**<br>**3. A territorialização da Atenção Básica à Saúde do Sistema Único de Saúde do Brasil**<br>**5. A Atenção Primária à Saúde no SUS: avanços e ameaças**<br>**8. Combining OpenStreetMap mapping and route optimization algorithms to inform the delivery of community health interventions at the last mile**<br> | Relacionar território, necessidades, recursos e rede de serviços | Gestores, planejadores e equipes |
| Coordenação da rede de atenção | **4. A atenção primária à saúde na coordenação das redes de atenção: uma revisão integrativa**<br>**5. A Atenção Primária à Saúde no SUS: avanços e ameaças**<br>**7. O uso de Tecnologias de Informação e Comunicação em Saúde na Atenção Primária à Saúde no Brasil, de 2014 a 2018**<br> | Controlar encaminhamentos, retornos, referências e planos de cuidado | APS, serviços especializados e regulação |
| Gestão da APS orientada por risco | **1. Evolução da estrutura e resultados da Atenção Primária à Saúde no Brasil entre 2008 e 2019**<br>**4. A atenção primária à saúde na coordenação das redes de atenção: uma revisão integrativa**<br>**5. A Atenção Primária à Saúde no SUS: avanços e ameaças**<br> | Planejar oferta, capacidade, equipes e acompanhamento longitudinal | Gestores e coordenações da APS |
| Observatório local de informação | **6. Inovações na Atenção Primária em Saúde: o uso de ferramentas de tecnologia de comunicação e informação para apoio à gestão local**<br> | Registrar, divulgar e analisar o trabalho das equipes | Profissionais, gestores, ensino e comunidade |
| Telessaúde e comunicação digital | **4. A atenção primária à saúde na coordenação das redes de atenção: uma revisão integrativa**<br>**6. Inovações na Atenção Primária em Saúde: o uso de ferramentas de tecnologia de comunicação e informação para apoio à gestão local**<br>**7. O uso de Tecnologias de Informação e Comunicação em Saúde na Atenção Primária à Saúde no Brasil, de 2014 a 2018**<br> | Apoiar decisões clínicas, educação e comunicação entre serviços | Equipes da APS e especialistas |
| Roteirização de visitas domiciliares | **3. A territorialização da Atenção Básica à Saúde do Sistema Único de Saúde do Brasil**<br>**4. A atenção primária à saúde na coordenação das redes de atenção: uma revisão integrativa**<br>**5. A Atenção Primária à Saúde no SUS: avanços e ameaças**<br>**8. Combining OpenStreetMap mapping and route optimization algorithms to inform the delivery of community health interventions at the last mile**<br> | Produzir agendas e caminhos considerando tempo, distância e prioridade | ACS, supervisores e gestores |

## 1. Monitoramento de indicadores da APS

**Paper de origem:** **1. Evolução da estrutura e resultados da Atenção Primária à Saúde no Brasil entre 2008 e 2019** — Barros, Aquino e Souza.

O estudo não apresenta uma plataforma nova, mas mostra como sistemas públicos de informação podem ser combinados para avaliar a estrutura e os resultados da APS. A solução tecnológica central é um ambiente de monitoramento que reúna dados de financiamento, cobertura e resultados de saúde para apoiar decisões baseadas em evidências.

### Funcionalidades

- **Painel de cobertura da APS:** apresentar a cobertura populacional por município, equipe, território e período.
- **Monitoramento de financiamento:** acompanhar despesa municipal em APS por habitante coberto, valores liquidados e evolução temporal.
- **Indicadores de resultado:** exibir mortalidade e internações por Condições Sensíveis à Atenção Primária (CSAP).
- **Comparação entre territórios:** comparar municípios, equipes ou regiões segundo porte populacional e nível de privação socioeconômica.
- **Estratificação de desigualdades:** destacar áreas com maior privação, mortalidade ou internações evitáveis.
- **Séries históricas:** mostrar tendências, mudanças de comportamento e períodos de redução ou aumento dos indicadores.
- **Visualização por grupos:** usar medianas, faixas e gráficos para evitar que valores extremos distorçam a leitura dos dados.
- **Alertas de variação:** sinalizar queda de cobertura, aumento de internações ou redução de financiamento.
- **Apoio à alocação de recursos:** indicar territórios que precisam de mais equipes, infraestrutura ou investimento.
- **Exportação de relatórios:** gerar tabelas e gráficos para planejamento municipal, avaliação e prestação de contas.

### Dados necessários

A solução depende da integração de bases como SIOPS, e-Gestor Atenção Básica, SIM e SIH/DATASUS. Os dados devem possuir período de referência, território, população utilizada no cálculo e indicação da fonte.

### Aplicação ao projeto

No sistema de visitas, esse módulo pode priorizar territórios com maior vulnerabilidade e acompanhar se o aumento da cobertura está acompanhado de capacidade efetiva de cuidado. A cobertura formal não deve ser usada sozinha: o painel deve ser combinado com necessidades clínicas, distância, frequência das visitas e capacidade das equipes.

### Cuidados

Os indicadores são agregados e descritivos. Eles ajudam a orientar decisões, mas não provam causalidade entre financiamento, cobertura e resultados de saúde. O sistema deve mostrar a data e a qualidade dos dados e evitar interpretações automáticas que não possam ser sustentadas pelas fontes.

## 2. Cadastro territorial e populacional da APS

**Papers de origem:** **2. Atenção Primária à Saúde**; **3. A territorialização da Atenção Básica à Saúde do Sistema Único de Saúde do Brasil**; **5. A Atenção Primária à Saúde no SUS: avanços e ameaças**.

Esses trabalhos tratam território, população adscrita e responsabilidade sanitária como elementos estruturantes da APS. A solução tecnológica correspondente é um cadastro territorial que relacione pessoas, famílias, domicílios, equipes, unidades e necessidades de saúde.

### Funcionalidades

- **Cadastro de pessoas e famílias:** registrar moradores, composição familiar, contatos e vínculos.
- **Cadastro de domicílios:** armazenar endereço, coordenadas, referências de acesso e características relevantes do local.
- **Adscrição de usuários:** associar cada domicílio e família à equipe responsável pelo acompanhamento.
- **Delimitação de microáreas:** dividir o território em áreas de atuação dos ACS.
- **Registro de vulnerabilidades:** informar barreiras de acesso, condições sociais, riscos ambientais e necessidades específicas.
- **Registro de condições de saúde:** armazenar condições crônicas, gestação, crianças, idosos, deficiência, saúde mental e outras situações prioritárias.
- **Histórico longitudinal:** consultar visitas, orientações, encaminhamentos, faltas e mudanças na situação da família.
- **Atualização em campo:** permitir que o ACS corrija endereço, localização, composição familiar e situação do domicílio durante a visita.
- **Transferência de responsabilidade:** registrar mudança de território, equipe ou unidade sem perder o histórico.
- **Busca por filtros:** localizar famílias por equipe, microárea, condição de saúde, prioridade e data da última visita.
- **Mapa de cobertura:** mostrar domicílios cadastrados, não cadastrados, sem visita recente e com informação desatualizada.
- **Controle de completude:** apontar campos ausentes, endereços duplicados e domicílios sem equipe responsável.

### Aplicação ao projeto

O cadastro é a base para a rota. Cada visita precisa ter um usuário, domicílio, equipe responsável, motivo, prioridade, duração esperada e intervalo máximo até o próximo contato. A localização não deve substituir a responsabilidade territorial: uma rota pode usar caminhos fora da microárea quando isso for necessário, mas as pessoas devem permanecer vinculadas à equipe responsável.

### Cuidados

Territorialização não é apenas desenhar polígonos no mapa. O cadastro deve representar relações sociais, responsabilidades e mudanças do território. Alterações devem ser auditáveis, com data, usuário responsável e possibilidade de correção.

## 3. Sistema geográfico de territorialização

**Papers de origem:** **2. Atenção Primária à Saúde**; **3. A territorialização da Atenção Básica à Saúde do Sistema Único de Saúde do Brasil**; **5. A Atenção Primária à Saúde no SUS: avanços e ameaças**; **8. Combining OpenStreetMap mapping and route optimization algorithms to inform the delivery of community health interventions at the last mile** — Randriamihaja et al.

Os trabalhos mostram que o território deve ser analisado como espaço social, político e dinâmico. A solução tecnológica é um Sistema de Informação Geográfica (SIG) integrado aos cadastros da APS e à rede de serviços.

### Funcionalidades

- **Mapa interativo do território:** exibir unidades, domicílios, equipes, microáreas, bairros, regiões e serviços de referência.
- **Camadas temáticas:** alternar população, vulnerabilidade, doenças, visitas pendentes, barreiras, caminhos e equipamentos sociais.
- **Geocodificação:** converter endereços em coordenadas e permitir ajuste manual quando o endereço não for suficiente.
- **Delimitação de áreas:** criar e editar territórios de equipes, microáreas e regiões de saúde.
- **Verificação de cobertura territorial:** identificar domicílios fora de áreas de responsabilidade ou áreas sem equipe.
- **Análise de acessibilidade:** calcular distância, tempo de caminhada, barreiras físicas e proximidade de unidades.
- **Localização de recursos:** apoiar a escolha de postos, pontos de apoio, locais de vacinação e serviços complementares.
- **Análise de concentração de necessidades:** localizar agrupamentos de vulnerabilidade, demanda reprimida ou visitas atrasadas.
- **Atualização colaborativa:** permitir que equipes registrem novos caminhos, mudanças territoriais e pontos inacessíveis.
- **Histórico geográfico:** comparar a configuração do território em diferentes períodos.
- **Integração com dados administrativos:** relacionar mapas a população, financiamento, cobertura e indicadores de saúde.
- **Visualização em dispositivos móveis:** disponibilizar mapas para uso durante o trabalho de campo.
- **Uso offline:** permitir download de áreas e sincronização posterior em locais com conectividade limitada.

### Aplicação ao projeto

O SIG deve fornecer a rede sobre a qual as rotas serão calculadas. A rota deve respeitar caminhos reais, áreas de responsabilidade, pontos de partida e retorno, e a matriz de deslocamento pela rede. O mapa também deve mostrar por que uma família foi incluída na agenda e quais restrições influenciaram o percurso.

### Cuidados

Mapas públicos podem estar incompletos ou desatualizados. O sistema deve registrar a origem, a data e a confiabilidade de cada geometria. Caminhos estimados não devem ser tratados como seguros ou transitáveis sem validação local.

## 4. Coordenação da rede de atenção

**Papers de origem:** **4. A atenção primária à saúde na coordenação das redes de atenção: uma revisão integrativa** — Rodrigues et al.; **5. A Atenção Primária à Saúde no SUS: avanços e ameaças**; **7. O uso de Tecnologias de Informação e Comunicação em Saúde na Atenção Primária à Saúde no Brasil, de 2014 a 2018**.

A revisão mostra que a APS precisa coordenar o cuidado verticalmente, com especialistas e hospitais, e horizontalmente, com outros serviços, setores e equipamentos sociais. A solução tecnológica é um sistema de coordenação de encaminhamentos e planos de cuidado compartilhados.

### Funcionalidades

- **Solicitação de encaminhamento:** registrar motivo, prioridade, serviço de destino e informações clínicas relevantes.
- **Catálogo da rede:** manter serviços disponíveis, especialidades, horários, critérios de acesso e formas de contato.
- **Regulação do acesso:** encaminhar solicitações conforme regras, disponibilidade e prioridade.
- **Acompanhamento de status:** mostrar se o encaminhamento está solicitado, agendado, realizado, cancelado ou pendente.
- **Controle de retorno:** registrar resultado do atendimento especializado e recomendações para a APS.
- **Plano de cuidado compartilhado:** reunir objetivos, tarefas, responsáveis, prazos e próximos contatos.
- **Alertas de pendência:** avisar quando não houver retorno, quando um prazo estiver vencido ou quando uma condição exigir acompanhamento.
- **Comunicação entre equipes:** disponibilizar mensagens e documentos dentro do contexto do usuário.
- **Registro de contrarreferência:** garantir que a equipe de origem receba a informação após o atendimento em outro ponto da rede.
- **Histórico de contatos:** manter uma linha do tempo de encaminhamentos, resultados e decisões.
- **Painel de gargalos:** identificar filas, serviços sem retorno e etapas que geram perda de continuidade.
- **Integração com visitas:** transformar encaminhamentos e pendências em tarefas de campo quando necessário.

### Aplicação ao projeto

Uma visita pode ser necessária para preparar um encaminhamento, verificar se o usuário compareceu, acompanhar uma recomendação ou identificar uma piora clínica. A agenda deve incorporar essas tarefas, evitando que o roteirizador trate todos os domicílios como pontos equivalentes.

### Cuidados

A existência de um canal de comunicação não garante coordenação. O sistema precisa exigir responsável, prazo, status e confirmação de recebimento. Deve também controlar permissões, pois os dados podem conter informações sensíveis de saúde.

## 5. Gestão da APS orientada por risco e capacidade

**Paper de origem:** **5. A Atenção Primária à Saúde no SUS: avanços e ameaças** — CONASS.

O documento defende uma APS territorializada, longitudinal e capaz de responder à diversidade das necessidades. A solução tecnológica é uma plataforma de planejamento que conecte demanda, risco, oferta, força de trabalho e resultados.

### Funcionalidades

- **Estratificação de risco:** classificar usuários e famílias por vulnerabilidade, gravidade, necessidade de acompanhamento e risco de perda de seguimento.
- **Agenda por necessidade:** reservar capacidade para demandas programadas, urgentes e acompanhamento de condições crônicas.
- **Controle de intervalos:** calcular a data limite para o próximo contato de cada usuário.
- **Gestão de capacidade:** mostrar horas disponíveis, composição das equipes, carga de visitas e áreas descobertas.
- **Distribuição equitativa do trabalho:** equilibrar tarefas considerando tempo de atendimento e dificuldade de deslocamento, e não apenas quantidade de pessoas.
- **Acompanhamento de condições crônicas:** criar planos recorrentes para diabetes, hipertensão, saúde mental e outras condições.
- **Autocuidado apoiado:** registrar orientações, metas, dúvidas e ações combinadas com o usuário.
- **Monitoramento de faltosos:** gerar listas de pessoas que não compareceram, não foram encontradas ou estão sem acompanhamento.
- **Gestão de campanhas:** planejar vacinação, busca ativa, educação em saúde e outras ações coletivas.
- **Relatórios de equidade:** comparar cobertura efetiva entre territórios e grupos vulneráveis.
- **Simulação de cenários:** estimar impacto de novas equipes, alteração de frequência e mudança do tempo médio das visitas.
- **Governança pública:** registrar decisões, regras de priorização, responsáveis e justificativas para alocação de recursos.

### Aplicação ao projeto

O algoritmo deve priorizar a combinação de risco clínico, vulnerabilidade, atraso, tempo de visita e deslocamento. A menor distância é apenas um dos critérios. O gestor deve poder ajustar pesos e visualizar o efeito de cada política de priorização.

### Cuidados

A estratificação não deve produzir exclusão automática. Usuários de baixo risco ainda precisam de acompanhamento conforme as regras da equipe, e situações não capturadas pelos dados devem poder ser incluídas manualmente por profissionais.

## 6. Observatório local de informação e comunicação

**Paper de origem:** **6. Inovações na Atenção Primária em Saúde: o uso de ferramentas de tecnologia de comunicação e informação para apoio à gestão local** — Pinto e Rocha.

A Rede OTICS-RIO mostra uma solução baseada em estações territoriais, blogs, sistemas de informação e espaços de educação permanente. Seu objetivo é tornar visível o trabalho das unidades e transformar registros cotidianos em informação para gestão.

### Funcionalidades

- **Página ou painel por unidade:** apresentar equipe, território, ações e indicadores locais.
- **Registro periódico do processo de trabalho:** documentar visitas, reuniões, campanhas, oficinas e problemas identificados.
- **Mural de ações:** divulgar atividades, horários, campanhas e orientações de saúde.
- **Biblioteca de materiais:** armazenar protocolos, guias, formulários e conteúdos de educação permanente.
- **Publicação por equipe:** permitir que profissionais registrem experiências e soluções locais.
- **Calendário compartilhado:** organizar reuniões, capacitações, campanhas e atividades territoriais.
- **Painel de indicadores:** acompanhar produção, cobertura, pendências e evolução dos territórios.
- **Busca de experiências:** localizar ações semelhantes realizadas por outras unidades.
- **Comunicação entre unidades:** compartilhar práticas, avisos e necessidades de apoio.
- **Relatórios de memória institucional:** preservar informações mesmo após mudanças na equipe.
- **Controle editorial:** definir quem pode publicar, revisar e corrigir conteúdos.
- **Integração com prontuários e sistemas oficiais:** evitar registro duplicado e permitir análise conjunta.

### Aplicação ao projeto

O observatório pode exibir o plano de visitas da equipe, registrar o que foi realizado, documentar obstáculos e mostrar pendências para a coordenação. Também pode apoiar reuniões de planejamento e compartilhar boas práticas de organização territorial.

### Cuidados

A plataforma não deve ser reduzida a um mural de notícias. Seu valor está em ligar publicação, análise e decisão. É necessário definir responsáveis, periodicidade de atualização, regras de qualidade e proteção de dados pessoais.

## 7. Telessaúde e comunicação digital

**Paper de origem:** **7. O uso de Tecnologias de Informação e Comunicação em Saúde na Atenção Primária à Saúde no Brasil, de 2014 a 2018** — Bender et al.

O estudo identifica Telessaúde, teleconsultoria, telediagnóstico, tele-educação e canais institucionais de comunicação como recursos para apoiar a prática clínica, a formação e a integração com a atenção especializada.

### Funcionalidades

- **Teleconsultoria assíncrona:** enviar dúvidas clínicas e receber respostas posteriormente, mantendo o histórico.
- **Teleconsultoria síncrona:** realizar discussão em tempo real entre APS e especialistas.
- **Telediagnóstico:** transmitir exames e informações para apoio diagnóstico remoto.
- **Tele-educação:** oferecer cursos, reuniões, webinários e materiais de capacitação.
- **Segunda opinião formativa:** registrar orientações que possam ser reutilizadas pela equipe.
- **Comunicação institucional:** disponibilizar canais oficiais entre APS, regulação e atenção especializada.
- **Notificações de resposta:** avisar a equipe quando uma orientação, laudo ou retorno estiver disponível.
- **Integração ao usuário:** vincular a comunicação ao cadastro e ao plano de cuidado correto.
- **Suporte à visita:** permitir que o ACS consulte orientações autorizadas durante o atendimento.
- **Registro de decisão:** documentar a recomendação recebida e a ação realizada.
- **Modo de baixa conectividade:** salvar a solicitação localmente e sincronizar quando houver internet.
- **Indicadores de uso:** acompanhar tempo de resposta, volume de consultas e temas recorrentes.

### Aplicação ao projeto

Durante uma visita, o ACS pode encontrar uma situação que exija orientação da equipe. A solução deve permitir registrar a dúvida e manter a tarefa pendente até a resposta. A comunicação deve fazer parte da agenda e não ocorrer em um canal separado sem histórico.

### Cuidados

O estudo mostra desigualdade de infraestrutura, conectividade e oferta dos programas. O sistema deve funcionar com conexão instável, ter suporte técnico e deixar claro quando uma informação ainda não foi sincronizada. Comunicação informal pode ser útil, mas não deve substituir registros institucionais protegidos e auditáveis.

## 8. Mapeamento e otimização de rotas

**Paper de origem:** **8. Combining OpenStreetMap mapping and route optimization algorithms to inform the delivery of community health interventions at the last mile** — Randriamihaja et al.

O artigo apresenta a solução tecnológica mais diretamente relacionada ao problema do projeto: combinar dados geográficos detalhados com roteirização sujeita a restrições de jornada e tempo de atendimento.

### Funcionalidades

- **Importação de dados geográficos:** carregar edificações, caminhos, estradas, unidades e limites territoriais.
- **Matriz de deslocamento:** calcular tempo e distância entre cada domicílio e os demais pontos da rota.
- **Roteamento em rede real:** usar caminhos disponíveis na rede de caminhada.
- **VRPTW:** distribuir visitas entre agentes considerando janela de trabalho, tempo de atendimento, partida e retorno.
- **Rota a pé:** modelar velocidade e caminhos adequados ao deslocamento dos ACS.
- **Prioridade de visita:** incluir urgência, atraso, condição clínica e frequência necessária.
- **Duração individual:** atribuir tempos diferentes para visitas simples, acompanhamento, educação e atendimento complexo.
- **Múltiplas equipes:** gerar rotas paralelas e equilibrar a carga entre ACS ou equipes.
- **Retorno à unidade:** garantir que cada agente termine a jornada no posto ou ponto de apoio, quando essa for a regra operacional.
- **Estimativa de pessoal:** calcular dias de trabalho, horas, distância e quantidade de agentes necessários.
- **Simulação de cenários:** alterar frequência mensal, duração da visita, velocidade, número de agentes e domicílios-alvo.
- **Seleção manual de domicílios:** permitir incluir ou remover pontos antes do cálculo.
- **Agenda diária:** apresentar ordem das visitas, horário estimado, tempo de deslocamento e tempo de atendimento.
- **Mapa da rota:** desenhar caminhos usados, pontos visitados, pontos não atendidos e unidade de referência.
- **Replanejamento:** recalcular a agenda quando uma visita falhar, surgir uma urgência ou um caminho ficar indisponível.
- **Exportação:** gerar GPX, PDF e CSV para uso em celular, tablet, papel ou outros sistemas.
- **Operação offline:** baixar a rota, registrar execução localmente e sincronizar depois.
- **Comparação previsto versus realizado:** medir atrasos, tempo real, visitas não realizadas e distância percorrida.

### Fluxo funcional

1. A equipe cadastra ou atualiza domicílios, condições e prioridades.
2. O sistema verifica a área de responsabilidade e a qualidade das coordenadas.
3. O gestor seleciona o período, as visitas pendentes e as restrições da equipe.
4. O sistema calcula tempos pela rede de caminhos.
5. O algoritmo distribui os pontos e monta as rotas.
6. O gestor revisa o resultado no mapa e pode alterar a agenda.
7. O ACS recebe a rota no dispositivo ou em formato impresso.
8. Durante o trabalho, cada visita é marcada como realizada, não realizada ou reagendada.
9. O sistema registra o motivo e recalcula as próximas agendas quando necessário.
10. A coordenação compara o planejamento com a execução e ajusta os parâmetros.

### Limitações que devem ser tratadas

O artigo ressalta que rotas geograficamente ótimas não representam todas as condições reais. O sistema deve permitir considerar segurança, acessibilidade, preferências dos ACS, horário em que a família pode ser encontrada, clima, inclinação, sazonalidade, retornos clínicos e atividades não previsíveis.

A ferramenta também não deve gerar itinerários definitivos a partir de domicílios estimados ou aleatórios. Para operação real, as localizações e situações das famílias precisam ser confirmadas pela equipe. O algoritmo deve apoiar a decisão e aceitar revisão humana.

## Funcionalidades transversais

As fontes, em conjunto, apontam requisitos que devem existir em qualquer solução tecnológica para APS:

### Interoperabilidade

- importar e exportar dados em formatos estruturados;
- integrar cadastro, mapa, agenda, prontuário, regulação e comunicação;
- identificar a fonte e a data de cada dado;
- evitar duplicidade de cadastro;
- permitir integração futura com sistemas públicos de saúde.

### Segurança e privacidade

- autenticar usuários por perfil;
- restringir dados clínicos conforme a função profissional;
- registrar acessos e alterações;
- criptografar dados em trânsito e, quando possível, em armazenamento;
- separar dados públicos de dados identificáveis;
- permitir correção sem apagar o histórico;
- definir política de retenção e backup.

### Uso em campo

- funcionar em celular e tablet;
- operar com conectividade limitada;
- sincronizar alterações com resolução de conflitos;
- preservar dados essenciais offline;
- consumir pouca bateria e dados;
- oferecer leitura clara em ambientes externos;
- permitir impressão quando o dispositivo não estiver disponível.

### Apoio à decisão

- explicar por que uma pessoa foi priorizada;
- mostrar restrições que influenciaram uma rota;
- permitir revisão manual;
- diferenciar estimativa, dado confirmado e dado desatualizado;
- mostrar incerteza e qualidade do mapa;
- oferecer simulações antes de aplicar mudanças no território.

### Acompanhamento e avaliação

- medir cobertura planejada e cobertura realizada;
- acompanhar visitas atrasadas e não realizadas;
- comparar tempo e distância previstos com os observados;
- avaliar carga de trabalho por equipe e território;
- monitorar encaminhamentos sem retorno;
- produzir relatórios de equidade e continuidade do cuidado.

## Síntese para o artefato do projeto

A combinação mais completa das soluções estudadas seria uma plataforma com seis módulos integrados:

1. **Cadastro territorial:** pessoas, famílias, domicílios, equipes, condições e prioridades.
2. **Mapa da APS:** microáreas, caminhos, serviços, vulnerabilidades e cobertura.
3. **Coordenação do cuidado:** encaminhamentos, retornos, planos e pendências.
4. **Planejamento de visitas:** agenda, intervalos, capacidade e distribuição da carga.
5. **Roteirização:** tempos reais, prioridades, jornada, múltiplas equipes e replanejamento.
6. **Monitoramento:** indicadores, execução, equidade, desempenho e qualidade dos dados.

A principal conclusão dos trabalhos é que uma tecnologia para APS não deve ser apenas um mapa nem apenas um algoritmo de menor distância. Ela precisa conectar informação clínica, responsabilidade territorial, comunicação entre serviços, capacidade das equipes e condições concretas do deslocamento. O resultado esperado é uma ferramenta de apoio ao trabalho dos profissionais, com revisão humana, continuidade do cuidado e foco em acesso equitativo.
