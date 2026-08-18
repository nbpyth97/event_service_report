# Deploy

## Security
- Verify if all frontend routes are protected with authentication and authorization
- Verify if all backend routes are protected with authentication and authorization
- Verify if the backend routes are correct for admin and user roles, so that a user can only access the resources that he has permission to access
 - User can only access the services that belong to the company that he belongs to and can not do operations that change state, just READ
 - Admin can create, read, update and delete services
- Verify how many days are refresh tokens are valid for and if they are stored in httpOnly cookies, secure and sameSite=strict

- Muito codigo do frontend ta usando role = 'admin' que nem faz mais sentido pq agora são tabelas diferentes, verificar se faz sentido e se não, remover
e corrigir verificaco de permissao para admin e user
- Remover toda essa lógica de isADmin, pq agora só existe customer and users and customer will not be authenticated, so the only way to access the backend is through the user table and the user table has a role column that can be 'admin' or 'user', so we can just check if the user is admin or not and if not, we can check if the user is the owner of the resource that he is trying to access
- Customer can not do any operations that change state, just READ, so we can just check if the user is admin or not and if not, we can check if the user is the owner of the resource that he is trying to access, so those operations such verify if the customer is owner of resource doesnt make sense anymore since admin can see all the entire data despiste if he not created (e.g another admin)

# Data
- Primeiros clientes
 - Cadastrar os usuários admin
 - Se quiseres, adicionamos também os serviços
- S3 Backups
- Migration from vercel to VPS

## Authentication / Authorization
- Rate Limiting for all routes and more restrictive for sensitive routes
 - Verify for 429 status codes
 - Choose reasonable number of requests per minute for each route

## Infra
- Database port
- Backend ports
- Backung running
 - Create a backup service to AWS S3


## Backlog
- um agendamento pode ter mais de um serviço?
 - Por hora não.
- Servidor está no brasil
 - Depois mudar para europa

### Security 
- Password policy? MFA? (Up to debate)
  - Obrigar a senha a ser minimo dificil com frontend validatiion as user types and backend validation as well
  - Ou ao menos adicionar MFA
  - Ver como ta a parte de hashing da senha se ja ta adicionando salt e pepper
- Impelementar cors no nginx para aceitar apenas o dominio do frontend e localhost


# http://localhost:5173/marcar-agendamento?company=salao-anabela
 - When not found, show not found page with a button to go back to home page