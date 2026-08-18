# Backlog
- sESSION_NAME = 'commit-changes'

- `Availiability Slots (Tenant Scoped)`
 - start_time fora do intervalo open/close
 - remove from logic of availiabity the "slot_interval_min": 15 but keep as business company settings
  - This will be used to show cards from intervals of 15 minutes, it will be configurable on user profile
  - Remove "min_lead_time_min" entirely from code
  - Need to confirm if slots that appear there are based on already estimated duration (What is awesome)
  - `This is the core logic of business, so we need to make sure that the logic is correct and that the slots are generated correctly based on the business settings and the already estimated duration of the services.`
  - See if frontend is using local timezone or UTC, and if the backend is using UTC, we need to make sure that the frontend is sending the correct timezone to the backend, and that the backend is returning the correct timezone to the frontend and for slot creation is doing correctly?

- Rever isso
  fix(availability): generate slots back-to-back by service duration

  Candidate slots now advance by the service's own duration instead of a
  fixed 15-min grid, and min_lead_time_min is gone entirely (it silently
  hid every slot within 30 minutes of "now"). slot_interval_min stays in
  company settings as a future display/grouping knob only.


- O que caracteriza um cliente?
 - ver esse codigo ainda

- `Manual Appointment`
 - Besides the user do appointment, the admin should be possible to create appointments too 
   - It will query users table from non admin roles, drop down list or search bar with live query from db with debouncing
    - Or just fetch all non admin users and use frontend filter instead for simplicity
    - Since its frontend filter, we register of user should invalidate cache on tan stack query

- `Appointment`
  - On list of appointments we need another field on database called alias name or something like that
   - Context: The customer can book, but some b2b admin knows close customer by another name
    - So we should have for the user on frontend a edit lucide icon maybe to edit or some way showing both with best ux (use frontend-design skill)
     to maybe show.
    - We need that to calenda view too
   - This have to query the user tables
    - `Isso aqui não tá tão claro da forma que foi implementada` e nem a questão do alias e alias_name e nem não ter auth pra não cadastrados

- `Calendar view`
 - When clicking on day on weekly and month view, it should change tab to daily and go to selected day view

- `Register Page`
 - Change Slug da empresa for something like nome da empresa or something like that


- `User View`
 - Remove from register, the register of user
  - For user, we just need phone + name (not name alias, because like said that will be admin only that will change that populating that field)
  - Phone and name are primary key
  - http://localhost:5173/marcar-agendamento/company=anabela
    - The ideia from customer is
    - Show on frontend the Nome da empresa (not possible to edit)
 - Since we have this should we move the users table away and have 2 different tables?
  - One for always admin and another for users?
 - On pedir marcação, frontend will have some formatting as he types for format number with placeholders for sure
  - The field is required since it needs the phone number

  - validation for phone number

  - idepotemcy for booking_id
   - information icon to explain about what is alias_name

   Anonymous customer
    │
    │ name + phone
    ▼
┌───────────────────┐
│ Find customer     │
│ tenant + phone    │
└─────────┬─────────┘
          │
       found?
       /    \
     yes     no
      │       │
      ▼       ▼
 existing    create
 customer    customer

 B2B employee
    │
    │ name + phone
    ▼
┌───────────────────┐
│ Find customer     │
│ tenant + phone    │
└─────────┬─────────┘
          │
       found?
       /    \
     yes     no
      │       │
      ▼       ▼
 existing    create
 customer    customer

# To Think

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
 -Interessante no final falar sobre urls e links de confirmacao
- Status Simplification

# UX



# Frontend
- All frontend routes on path parameters should be portuguese, for example /marcar-agendamento instead of /book-appointment
- verificar se user.role === 'admin' no frontend faz sentido, pq agora são tabelas diferentes
 - Remover isAdmin conditional rendering
  - For simplicy, new foled called public and that will be on scope of not ProtectedRoute
  - Another routes with with ProtectedRoute and that will be on scope of admin only 

# Fix
- Size of icon and ux of it related to creation of appointment on clients page

# Dead Code
- Consolidate migrations or just delete all revisions and use auto generate if possible
- Remove DEFAULT_COMPANY_SETTINGS
 - This will be on profile settings for each company, and will be used to show cards from intervals of 15 minutes, it will be configurable on user profile

# Fast Verify
- Confirm if AI for frontend used a wrapper class for api.ts to on not sucess, show .detail.message kind
- Acho que a IA T gerando links de booking de confirmacao 
 - Interessante para passar para o admin

- missing toast notifications for sucess/failed operations
 - all must have
  - use ux guidelines for toast notifications

# Missing
- The manual appointment creation for admin users should have a way to select the customer from a list of existing customers, or create a new customer if they don't exist and there he can create a new customer with name and phone number, and then create the appointment for that customer. it should be possible from agendaments page
for already existeant customers with + icon on top right to create a new appointment for that customer,

- Didnt change the ballon icon to use whatsapp green font color with phone number on agendamentos page



# Notes
- The flow already create a manual apppointment but after creation is default it needs to be approved (can be himseilf ) or maybe another person

# Features
- Profile Page
 - Company Setting
  - The list is
   - Open Time
   - Close Time
   - Slot Interval (in minutes)

  
# Later
- Criar DESIGN SYSTEM para o projeto, com componentes reutilizáveis e consistentes, para facilitar a manutenção e evolução do projeto.
 - Ele ta gerando butões com cores diferentes, e isso não é bom para a consistência do projeto, então criar um design system com cores, tipografia, espaçamento, etc, para que o projeto fique mais consistente e fácil de manter.
 - Adicionar serviço, adicionar cliente, nova marcacao - butoes diferentes
  - ← Escolher outro serviço button ta com cores boas

- The bell pressing of notification once clicked should update the customer table or something
to remove that and invalidate cache on frontend to remove the bell icon
- Tests
 - Unit Tests -> Pure busines logic (policy, mocked services, etc)
 - Integration Tests -> API and DB



# Changed
- Select one day specifc on montlhy and weekly view, and go to daily view with selected day

- Centralized sarch filter with debounce of 0.1s across agendamentos, clientes and services pages

- Created customer pages view with number of appointments
 - Clickable clink redirecting to agendamentos paging filter the appointments for that customer on current wekk
 - Added local search filter for filtering by name and phone number

- Created Services public page with list of services and their prices, and a button to book an appointment for that service
 - The button will redirect to the booking page with the service pre-selected
 - Add frontend local search filter for filtering by service namme
 - Date picker and show only available days for that service, and show only available time slots for that service on that day

  - Verify if duration cross boundary the closed time, if allows or not?
   - Maybe business settings

- On clients, add the possibility of creating the customer and his phone number

- Improve notifications
 - No longer repeated texts anymore
 - Now drives to action
  - Pending actions now show there and on clicking goes to appointment and can confirm/deny there

- Compnay registration page with slug and name, and a button to register the company
 - When doing the register, it will create the company and the admin user for that company, and redirect to the login page with a success message and
 show already the link to login page with the company slug pre-filled, so the user can just enter his email and password to login.

- Created customer tables (Check this)
 - Customer now demands name and phone number, and the combination of name and phone number is unique, so we can identify the customer by name and phone number, and we can have multiple customers with the same name but different phone numbers, or multiple customers with the same phone number but different names, but we can not have multiple customers with the same name and phone number combination.

- ta falando no banco de dados contrainst de duuplicado de agendamento
 - Tem que ter unique
 -  start_time + tenant_id + service_id
 -  start_time + tenant_id + service_id + customer_id 

- Error Messages
 - Backend should return error messages in portuguese, and frontend should just display the http response error message from detail, so that the user can understand what went wrong and how to fix it.




# Doubts
- Are phone numbers nullable on customer table?
- Ver como tá todo o app no mobile...

