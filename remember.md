# Features
- Company Settings 
    - Business hours for each day of the week
    - Available time slots for each day of the week

- Reminders
  - Pooling every 5 minutes?
   - Verify that. is that SSE? 
    - What is currently SSE?


  #### Notifications
  - Customer:
     - When booking is confirmed, the customer should receive a notification
     - When booking is refused,   the customer should receive a notification
     - Customer should receive a notification 1 day before the booking, reminding him of the booking




- #### Integrations
  - Whatsapp
     - B2C:
        - Reminder of appointment on whatsapp (1 day before)
        - Se for recusado, confirmado ou cancelado

- Web push
 - B2B

- Reminder
 - B2C -> Metacloud API 

# Pedir pra ia cechar se ta tudo em UTC e frontend ta usando local timezone - simple as that

- Doisc canais de comuniccao PARA confirnmar recysar
 - SMS
 - Portal WEB
 - Invalidate cache no frontend
  - Regra de negócio travar alteração de status de agendamento ja alterado 
   - Testes unitarios e regras de negocio no codigo em pytho puro

# To Implement
- Business rules
 - Verificar se IA não está criando agendamentos em horários que não estão disponíveis


# Backlog
- Web push
 - Para o admin

- Reminder 
 - Meta cloud api

# To keep
- Notification of pending appoiintment on whatspapp.
- When confirming an appointment, the user should receive a notification on whatsapp 

# Database
- Docker container
- It has to have backup docker service to AWS S3
- Health check endpoint to check if the database is up and running

- Revisar ngixn conf and gzip reponse

# Back log
- Reminder serem com integracies (wpp, email, sms)

- Mudar cores para branding da empresa
 - Vou pegar as cores do site da empresa e colocar no app
 - Notifications should disappear and READ 

- Ver se sse ta funcionado com aba EeventStream
  - Pedir pra ele criar 3 appointments em seguida

# Whatsapp icon
- Olá {{customer_name}}, sobre a sua marcação de {{service_name}} às {{appointment_time}}. 
O seu agendamento foi {{appointment_status}}. Obrigado. Isso seria o botão de "Mandar atualização".
- Outro butão para ser "Falar com a {{customer_name}} no whatsapp" que abre o whatsapp web com a mensagem pre preenchida para mandar para o cliente

# Notifications

## Infra

9h{a,(Eh8+90

# Scope
- Mobile first
- Dashboard não tá 100% bom no mobile

# Problems
- Update ao final do dia
 - Atualmente tá em hora em hora (1 cron job)
 - Tá na vercel

# Deploy

# Supabase
- Migrate data from supabase to container on VPS
 - Backups to AWS S3

# Integrations
- Whatsapp
 - Check if the integration is working
 - Check Rate Limit and Pricing


# NA tela de agendamentos
- Ta falando o numero de wshatsapp

# CHange
- Aqui no frontend  o display vai ser
 name_alias e colocar botão de edit
 name:
 name_alias: default = name
- no painel de marcao, 
  nome
  nome alias


# Nice to have
- Tenant id:
 - Cada funcionário ver seus agendamentos
 - Talvez ter tenaind_id=uuid.v4()


- Notifications (Server Sent Events)
 - To Accept, Tou refuse
 - Accepted/Refused
 - 1 dia antes do agendamento


## Dominios
- Criar dominio para nossa empresa


# Digital
- Google maps
 - Botar no site embedded do location do estabelecimento


# Backlog
- Emails pesosais vs Emails business
 - Oath, redirects
 - Somente acesso de leitura e escrita a emails exclusivos relacionados a agendamentos
  - Falar que não lê nada de emails pessoais, somente os relacionados a agendamentos

# Vercel
- Deploy vai ficar lá
