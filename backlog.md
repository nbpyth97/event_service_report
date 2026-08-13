# Features
- The services related endpoints should require authorization not only authentication, so that a user can only access the services that belong to the company that he belongs to and can not do operations that change state, just READ 
- Admin can create, read, update and delete services 
- User can only read the services that belong to the company that he belongs to and make the agendamentos for those services, but can not create, update or delete services


# UX
- Mobile view it seems good for rest of application but not for dashboard
 - Refactor dashboard to be mobile first
 - Refactor dashboard to be more user friendly
- Priority: 2
- Type: UX

# Frontend
- Folder structure:
 - src
  - api
   - agendamento.ts
   - auth.ts
   - user.ts
  - components
   - AgendamentoForm.tsx
   - AgendamentoList.tsx
   - AuthForm.tsx
   - UserForm.tsx
  - pages
   - AgendamentoPage.tsx
   - AuthPage.tsx
   - UserPage.tsx

# Missing Features
- Tela de cadastro de servicos
- Os serviços são cadastrados pelo usuário e cada serviço sempre tem vínculo com tenant_id, que é o a empresa
- Uma empresa pode ter vários serviços e uma empresa possui vários usuários, mas cada usuário só pode ter acesso aos serviços da empresa que ele pertence (RLS)

# Security
- Frontend routes should use authcontext react
 - All Routes should require authentication to be accessed
- Rate limiting for all routes and more restrictive for sensitive routes
- RBAC for all routes, so that a user can only access the resources that he has permission to access
 - Just 2 types: admin and user

- Obrigar a senha a ser minimo dificil com frontend validatiion as user types and backend validation as well
 - Ou ao menos adicionar MFA
 - Ver como ta a parte de hashing da senha se ja ta adicionando salt e pepper

- rate limit nas senhas
- eu tenho alguma coisa pra invalidar refresh token? se sim, como funciona?

- cors ta com localhost

## Authentication /Authorization
- JWT tokens should be used for authentication with short expiration time and refresh tokens
- Refresh tokens should be stored in httpOnly cookies and access tokens should be stored in memory
 - On page load, the access token should be refreshed if the refresh token is valid
 - It should be possible to logout and invalidate the refresh token
- All endpoints should be protected with role based access control (RLS) and only allow access to resources that the user has permission to access  and all endpoints should require authentication except for the login and register endpoints

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

- on 



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


# Security
- RLS
 - 1 empresa = 1 usiario
 - Authorization/Authentication

# Supabase
- Migrate data from supabase to container on VPS
 - Backups to AWS S3

# Integrations
- Whatsapp
 - Check if the integration is working
 - Check Rate Limit and Pricing




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
