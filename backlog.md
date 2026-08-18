# Backlog

## Reativar registo self-service (`/registar`)

Desligado em 2026-08-18. So reativar quando existir envio de email com link de
confirmacao no signup — sem isso nao ha como validar que uma empresa nova e
real. Ate la os tenants B2B sao criados manualmente (poucos clientes).

### Frontend — desligado (comentado, codigo intacto)

- `src/frontend/src/App.tsx` — a rota `<Route path="/registar">` e o import de
  `RegisterPage` estao comentados. Com a rota fora da arvore, `/registar` cai no
  `<Route path="*">` → redireciona para `/` → `ProtectedRoute` → `/entrar`.
- `src/frontend/src/pages/public/LoginPage.tsx` — o link "Nao tem conta?
  Cadastre-se" (`<p className="auth-hint">`) esta comentado, junto com o import
  do `Link`, que ficaria por usar.
- Os dois imports tiveram de ser comentados tambem porque `tsconfig.json` tem
  `noUnusedLocals: true` — senao o `tsc` falha.
- `pages/public/RegisterPage.tsx` nao foi tocado.
- - A confirm password field should been added
Para reativar: descomentar o import + a rota em `App.tsx`, e o `<p>` + o import
do `Link` em `LoginPage.tsx`. Nada mais.

### Backend — continua ABERTO (decisao deliberada)

`POST /api/auth/register-company` (`src/backend/app/routers/auth.py:18`)
permanece registado e acessivel. Esconder a pagina nao fecha o endpoint: quem
souber a rota ainda consegue criar uma empresa via API. Isso e proposital — e
por ai que os tenants sao criados manualmente enquanto o signup publico esta
desligado.

Consequencia a ter em conta: o registo de empresas nao esta fechado ao publico,
so nao esta divulgado na UI. Se algum dia isso passar a incomodar, a opcao
discutida foi um feature flag (ex. `ALLOW_SELF_REGISTRATION`, default `false`,
ligado nos testes e no seed) em vez de comentar o handler.

Porque nao foi comentado: 9 ficheiros de teste
(`src/backend/tests/test_agendamentos_router.py`, `test_agendamento_history.py`,
`test_auth_flow.py`, `test_availability_service.py`, `test_companies_router.py`,
`test_notifications_flow.py`, `test_services_router.py`, e outros) criam o
tenant com um helper `_register_company(client, slug)` que faz POST nessa rota.
Comentar o handler partia praticamente toda a suite backend.


# Notes
- The flow already create a manual apppointment but after creation is default it needs to be approved (can be himseilf ) or maybe another person
 - The owner itself can do it, but create with status pending by default and then need to approve it, or maybe another person can approve it, but the owner itself can do it too


# CUstomer Link Status
- URL Link for customer
 - On success generate url link, showing , "Sucess here is link" kind
 - It should be possible to share this link with the admin of the company, so that the admin can confirm or refuse the appointment without needing to login, and the link should be valid for a limited time (ex: 24h + end_time) and it should be possible to invalidate the link if the appointment is cancelled or refused.
 - With that link, it should be able to cancel the appointment
 - Revoked
 - User with link can see status and cancel the appointment, but not edit the appointment
  - Now cancelado status makes sense, but for customer. For admin, it will be recusado, and for customer it will be cancelado. So we need to make sure that the status is consistent across the system and that the user with the link can see the status of the appointment and can cancel the appointment if needed.
 - Copiar part do prompt do chatgpt que fala sobre isso.
 - Quando agendamento for feito com sucesso, o cliente consegue ter um link de confirmação do agendamento, que ele pode compartilhar com o admin da empresa, para que o admin possa ver o agendamento e confirmar ou recusar o agendamento. (isso é importante para b2b, pois o cliente pode não ter acesso ao sistema, mas o admin da empresa tem acesso ao sistema e pode confirmar ou recusar o agendamento). O usuário deveria de alguma forma com esse ou outro link ver o status do agendamento.

 - Entender como gerar link seguro e com idepotency para o agendamento, para que o admin possa confirmar ou recusar o agendamento sem precisar de login, e que o link seja válido por um tempo limitado (ex: 24h) e que seja possível invalidar o link caso o agendamento seja cancelado ou recusado.
- https://chatgpt.com/c/6a837228-b04c-83eb-9e8a-f14dbc8ba1de