# Deploy
- S3 Backups
- Migration from supabase to postgres
- Migration from vercel to vps
- 


## Authentication / Authorization
- Rate Limiting for all routes and more restrictive for sensitive routes
 - Verify for 429 status codes
 - Choose reasonable number of requests per minute for each route
 - public routes on frontend should be rate limited to avoid abuse

## Infra
- Database port
- Backend ports
- Backung running
 - Create a backup service to AWS S3


### Security 
- Password policy? MFA? (Up to debate)
  - Obrigar a senha a ser minimo dificil com frontend validatiion as user types and backend validation as well
  - Ou ao menos adicionar MFA
  - Ver como ta a parte de hashing da senha se ja ta adicionando salt e pepper
- Impelementar cors no nginx para aceitar apenas o dominio do frontend e localhost


# http://localhost:5173/marcar-agendamento?company=salao-anabela
 - When not found, show not found page with a button to go back to home page