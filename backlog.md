# Before Deploy

## Security
- Verify if all frontend routes are protected with authentication and authorization
- Verify if all backend routes are protected with authentication and authorization
- Verify if the backend routes are correct for admin and user roles, so that a user can only access the resources that he has permission to access
 - User can only access the services that belong to the company that he belongs to and can not do operations that change state, just READ
 - Admin can create, read, update and delete services
- Verify how many days are refresh tokens are valid for and if they are stored in httpOnly cookies, secure and sameSite=strict
- RLS on database level, so that even if the user has access to the database, he can only access the data that he has permission to access

## Authentication / Authorization
- Rate Limiting for all routes and more restrictive for sensitive routes
 - Verify for 429 status codes
 - Choose reasonable number of requests per minute for each route

## Infra
- Database port
- Backend ports
- Backung running
 - Create a backup service to AWS S3

# Backlog

## Features
- ### Status Transtitions
  - All status:
    - cancelado, confirmado, pendente, recusado
    - Transitions:
      - pendente -> confirmado (Somente admin pode confirmar um agendamento pendente)
      - pendente -> recusado (Somente admin pode recusar um agendamento pendente)
      - confirmado -> cancelado (Somente admin pode cancelar um agendamento confirmado)
      - recusado -> cancelado (Somente admin pode cancelar um agendamento recusado)
      
  - When booking is created, it should be status: pending

  - User:
    - pendente -> User can cancel the booking while the status is pending
  - Allowed booking_status_transitions:
  - pending -> confirmed
  - pending -> refused
  - confirmed -> canceled
 
 - Only the admin can cancel a booking that is confirmed or refused, the user can only cancel a booking that is pending



#### Notes
- um agendamento pode ter mais de um serviço?
 - Por hora não.
- Servidor está no brasil
 - Depois mudar para europa
- Deliveried: 


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

  - #### Company Settings
    - Business hours for each day of the week
    - Available time slots for each day of the week

# To Implement
- Owner mesmo fazer agendamento manual dos clientes
- Owner can cancel a booking that is confirmed or refused (state transition)
- User view
  - Authorization?
    - Oauth
  - No authorization
    - Just sms/email verification?
  - Location

# Session Claude Name = 'enums-and-cancel-authorization'
- Repository class filter
- Prefill the 
 - The cheap alternative that solves the actual pain point

  If the goal is just "stop making users type/remember their company slug," you can get most of that without any of the above:

  - Frontend remembers tenant_slug in localStorage after first login and prefills it next time — zero infra change.
  - Or a bookmarkable/shareable link: yourapp.com/login?company=anabela — frontend reads the query param, prefills (or hides)
  the slug field. Also zero infra change, and it's a link a salon can put in their own bio/website today.

  Either gets you 90% of the UX win this session, today, in the frontend only.

  My recommendation

  Postpone subdomains. Not because the idea is wrong — it's the standard pattern, and the pasted comparison is basically
  correct — but because right now you have one pilot tenant (anabela), no stated requirement for white-labeled/custom domains,
  and the actual pain point (typing a slug) has a same-day fix that costs nothing infra-wise. Subdomains become worth the
  DNS/TLS/nginx/signup-flow work when either: (a) you're onboarding enough real tenants that "remembering your slug" becomes
  recurring support noise, or (b) a customer specifically wants/pays for a branded URL. Until one of those is true, it's
  solving tomorrow's problem with today's effort — the definition of the overengineering you said you wanted to avoid a few
  turns ago.
 

# eXPLAINATION

export interface CompanySettings {
  timezone: string;
  slot_interval_min: number;
  min_lead_time_min: number;
  business_hours: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DayHours>;
}


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


## Technical
- Password policy? MFA? (Up to debate)
  - Obrigar a senha a ser minimo dificil com frontend validatiion as user types and backend validation as well
  - Ou ao menos adicionar MFA
  - Ver como ta a parte de hashing da senha se ja ta adicionando salt e pepper
- Impelementar cors no nginx para aceitar apenas o dominio do frontend e localhost

# Features

# Status transition
 - Admin:
 - User:

# Dúvidas
- Ver index.js o que tem la de notificacao

# UI

# Must
- Copy from google calendar style ()
 - cUSTOMER, service, hour
 duration, status (color background)

- On confirmar button, it open a poup up to pre fill the message to send to whatsapp


# Backlog
- Web push
 - Para o admin

- Reminder 
 - Meta cloud api

- Possibilidade do admin cancelar o agendamento pelo admin
 - 

- Generate apk?
 - Talvez no apk tenha alguma coisa de bota pra atualizar o app, mas nao sei se isso é possivel

# To keep
- Notification of pending appoiintment on whatspapp.
- When confirming an appointment, the user should receive a notification on whatsapp 


# To verify and confirm
- 2 roles only: admin and user (customer)

# Database
- Docker container
- It has to have backup docker service to AWS S3
- Health check endpoint to check if the database is up and running

- Revisar ngixn conf and gzip reponse

# Utils
- bash.sh to spin up local frontend and backend containers
 - frontend: http://localhost:5173
 - backend: http://localhost:8000

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
## Considerations
- Pooling every 5 minutes not 1
- Really paginated SSE?



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


# Reminder do lado do cliente


# NA tela de agendamentos
- Ta falando o numero de wshatsapp


# Faz mais sentido ter:
 - Fluxo de aprovações
 - Agendaments confirmados
 - 

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
