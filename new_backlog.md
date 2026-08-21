# Done

## Sessions to resume = 'features-to-implement', ' rls-alternative-solutions'
- `Availiability Slots (Tenant Scoped)` -> Verificar isso
 - start_time fora do intervalo open/close
 - remove from logic of availiabity the "slot_interval_min": 15 but keep as business company settings
  - This will be used to show cards from intervals of 15 minutes, it will be configurable on user profile
  - Remove "min_lead_time_min" entirely from code
  - Need to confirm if slots that appear there are based on already estimated duration (What is awesome)
  - `This is the core logic of business, so we need to make sure that the logic is correct and that the slots are generated correctly based on the business settings and the already estimated duration of the services.`
  - See if frontend is using local timezone or UTC, and if the backend is using UTC, we need to make sure that the frontend is sending the correct timezone to the backend, and that the backend is returning the correct timezone to the frontend and for slot creation is doing correctly?

- `Calendar view`
 - When clicking on day on weekly and month view, it should change tab to daily and go to selected day view

- ` Frontend routes`
 - All frontend routes on path parameters should be portuguese, for example /marcar-agendamento instead of /book-appointment

- `Remove registrar page since` 
 - There i no there is no email link confirmation for signup
 - This makes more sense when being an app maybe
 - Changed Slug da empresa for nome da empresa

- `Frontend conditional rendering`
 - Removed isAdmin conditional rendering and split the routes into 2 different routes, one for public and another for admin only
- verificar se user.role === 'admin' no frontend faz sentido, pq agora são tabelas diferentes
 - Remover 
  - For simplicy, new foled called public and that will be on scope of not ProtectedRoute
  - Another routes with with ProtectedRoute and that will be on scope of admin only 

- `Profile Page`
 - Company Setting
  - The list is
   - Open Time
   - Close Time
   - Slot Interval (in minutes)

- `User View`
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

- `The bell pressing of notification once clicked`
 - It should update the customer table or something
to remove that and invalidate cache on frontend to remove the bell icon
   - Should on confirm always already open the wpp? seems noisy

- `Add notes maybe for agendamentos`

# To implement


## To Do/Align
- web push

# To Confirm

# Verify
- Phone Verification 
 - We need to change the phone verification without using external library from javascript and python that
 does that easily SUCH phonenumbers. 
 - Context: They have customers from different countries so we need a more generic solution for phone number validation and formatting
 without using external libraries.
 - Of course this validation is frontend and backend, but we need to make sure that the validation is correct and that the phone number is valid for the country of the customer.
 - They are not exclusive to portugal. This affects too the editing customer phone that currently it seems to show only last 9 digits.



# To IMplement
- Password reset for each user name and tenant_id
- O que é melhor como default page on first render? 
 - Visao geral ou Calendario?
 - E edepois vai ser qual hoje, todo ou essa semana?

## Feature
- Primeiros clientes will be created login manual

