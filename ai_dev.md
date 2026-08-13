# Done 
- Install frontend design skill
- Maybe delete docker file from frotnend
- Verify postgres dev

# Verify 
- Remove the superuser from the system 

# Dúvidas
- Need to udnestand better config.json
- Entender 
 -   {"price": 20.0, "duration_min": 60, "wax_g": 220, 
      "wax_cost": 7.70, "disposables": 0.50, "extras": 0.30, "total_cost": 8.50},
- Parece dead code  mint_write_token.py
- O cliente vai ter tela de login pertencente ao tenant ou vai ser usuario anonimo que vai marcar o agendamento?
 - Link de agendamento vai ser enviado por email para o cliente, e ele vai poder acessar a tela de agendamento sem precisar de login.
 - ou sms
- As questoes do status de cada um:
 - b2b: 
   - disponivel, selecionado, ocupado, indisponivel, aprovado, negado, cancelado, etc
 - b2c:
   - cancelado, confirmado
- Quem surgere o horário é o cliente dps de está disponivel ou são slots que o admin disponibiliza e o cliente apenas escolhe?
- Pedir de novo pra ele mostrar o sistema como todo
- O que seria bom de reminders e notificacoes
- Lifecycle do cliente 
 - SMS, email, wpp, etc
 - Sempre pedir wpp?
  - Chato
  - Session_id, deevice_id

# Matches ux color design from login with the rest including border on inputs and border rounding
# Input on mobiel on login asking for payment method, saved password, that same problem again

# Dev (B2C)
- Tela de agendamento do cliente deve ser simples, apenas com os campos de nome, email, telefone e horario disponivel para marcar o agendamento
 - Vao ser slots ou sugerir um horário e o admin aprova ou nega?
 - Clientes
 = Campo de telefone vai ser mandatorio? 
  - Se nao fica dificil confirmar/recusar/cancelar agendamento

# To Do
- The logout icon should be font color red and more far away and divided by grouping by space from profile and dark mode icons
- remove claude in chorme
- Verificar quem tá setando o preço só pode ser staff e admin
 - customer nao pode fazer nada fora agendamento

# Dev
- Colocar autocompact na config da ai no .claude/settings.json
- Colocar playwritgh dado video daquele cara programador com mcp e deixar ele la fazendo tudo
- Verificar se os endpoiints não estão com algum .limit de 1000 ou 10000, e se tiver, remover
# Tests
- Pedir pra ia gerar pending agendamentos
- Ver como a invalidacao de cache ta funcionando

# Feature
- For tenant search by client, as b2b types should appear live dropdown of filtered clients
- switch the position of agendamentos icon with servicos
- When clinking on agendamento, should show the details of that agendamento, with the status and other information for panel and agendamentos page.

- Agendamentos esta ate ok como view especifica de um dia
 - but what i n eed is filter by period and tabs with status
   - The filter result/cardlist should have good summarized information shuld pending confirmations, confirmed and etc
- Perguntar sobre status condcluido
-Ajeitar filtros em angemdaneots, ta pessimo
- Deixar mais marcanete nome da nossa empresa e nao nome slug do tenant
- Separar organizacao do frontend em pages
 pages admin e pages customer
- Visao geral deve ser todos os dias
 - group by day, and show the overall status of each day, when clicking a collapsable show the agendamentos of that day, with status and other information and clicking on each agendamento should show the details of that agendamento
  - Some detail important information, must:
    - Customer name
      - Services name
      - Status
      - Price by service
      - Total cost
- Colocar nos agendamentos o icone de wpp/email para enviar mensagem para o cliente

# Fwature
- Backend
 - Activity audit log for agendamentos
  - For each transition status, log  the timestamp and display on the agendamento details page

= Do lado do "customer"
 - Menos fricacao sem autenticacao
 - Apenas numero do telemovel/email do cliente para enviar mensagem de confirmacao
  - Pode ser wpp ou SMS 

 - Reminder parao client por email sobre a marcacao

## Features/Business Logic
- Ver como vai ficar a logica de
 - disponivel, selecionado, ocupado, indisponivel, aprovado, negado, cancelado, etc
 - Verify if transition status matches too

## Technical
- Create tests
 - Unit
 - Integration
 - E2E
- For backend, quality gates on ci cd


## Tab de profile
- Ele coloca o nome do usuario, email, telefonee e horario de funcionamento do negociod

# Notes
- Removed google calendar integration
# Features
- Tela de cadastro de serviços

 remember that is booking from customer and approval deny from admin. It should be easy to see the slots availiabied
  not available for both customer and admin, so think what should be a must on ui regarding important info. Use
  frontend-desgin skill to polish the page
