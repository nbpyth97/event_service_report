Yes. Given that you're going with path-based tenancy, I'd make the UX tenant-first, but I would slightly change the terminology and the JWT design.

1. UX: ask for the workspace/company first

Start with:

https://app.example.com/login

Show:

┌─────────────────────────────┐
│ Sign in                     │
│                             │
│ Company / workspace         │
│ [ acme                    ] │
│                             │
│          Continue           │
└─────────────────────────────┘

The user enters a tenant slug, not necessarily the legal company name.

For example:

"Acme Corporation"  →  "acme"

Your frontend calls:

POST /auth/discover
{
  "tenant_slug": "acme"
}

The backend resolves:

acme
  ↓
tenant_id = 550e8400-e29b...

Then redirect:

https://app.example.com/acme/login

Now every subsequent route is tenant-scoped:

/acme/dashboard
/acme/orders
/acme/settings
2. Don't put the tenant UUID in the URL

I'd use:

/acme/dashboard

rather than:

/550e8400-e29b-41d4-a716-446655440000/dashboard

The slug is for routing and UX.

The UUID remains your internal canonical tenant identifier.

3. Your JWT should absolutely contain tenant_id

Yes.

If your authenticated identity is tenant-bound, your JWT can contain something like:

{
  "sub": "user-uuid",
  "tenant_id": "tenant-uuid",
  "session_id": "session-uuid",
  "iat": 1754920000,
  "exp": 1754920900
}

You sign this with your JWT signing key.

But there's an important distinction:

You don't put tenant_id in the JWT "with the secret key."

You put the tenant_id inside the JWT claims, and the entire JWT is cryptographically signed.

For example:

JWT
 ├── header
 ├── payload
 │    ├── sub
 │    ├── tenant_id
 │    └── exp
 └── signature
          ↑
       signing key

The user can decode the JWT and see:

{
  "tenant_id": "abc"
}

but cannot change it to:

{
  "tenant_id": "another-tenant"
}

without invalidating the signature.

4. But the URL still matters

Suppose I'm authenticated as:

tenant_id = ACME

Then I request:

GET /acme/orders
Authorization: Bearer <token>

Your backend should compare:

URL tenant = acme
JWT tenant = ACME

and only proceed if they correspond to the same tenant.

Don't do this:

tenant_id = get_tenant_from_url()

and blindly use that for RLS.

Otherwise someone could potentially do:

/acme/orders

then change it to:

/other-company/orders

and attempt to access another tenant.

Instead:

                 Request
                    │
          ┌─────────┴──────────┐
          │                    │
      URL slug              JWT
       "acme"            tenant_id=123
          │                    │
          ▼                    ▼
     resolve tenant        validate JWT
          │                    │
          └─────────┬──────────┘
                    │
                 compare
                    │
             ┌──────┴──────┐
             │             │
           match        mismatch
             │             │
             ▼             ▼
            RLS          403
5. Then RLS becomes your final security boundary

This is where your architecture gets really nice.

Your application determines:

JWT
 ↓
tenant_id = 123

Then establishes the PostgreSQL context:

SET LOCAL app.tenant_id = '123';

Your RLS policy ensures:

tenant_id = current_setting('app.tenant_id')::uuid

So you have defense in depth:

Path
 ↓
/acme
 ↓
tenant slug resolution

JWT
 ↓
tenant_id = 123
 ↓
must match URL tenant

PostgreSQL
 ↓
RLS
 ↓
tenant_id = 123

Even if you accidentally introduce an application-level query bug, RLS provides another barrier.

6. One thing I'd change in your login flow

I wouldn't necessarily make the user enter the company name.

Use:

Workspace

or:

Company / workspace

and have a unique slug.

Database:

tenants

id          UUID
name        "Acme Corporation"
slug        "acme"

Login:

Workspace
[ acme ]

Then:

POST /auth/discover
       ↓
slug = acme
       ↓
tenant exists?
       ↓
/acme/login

You can make it nicer later with an autocomplete, company logo, remembered workspace, email-domain discovery, etc.

The complete flow I'd use
                     /login
                        │
                        ▼
              Enter workspace slug
                        │
                        ▼
                POST /auth/discover
                        │
                        ▼
                  slug → tenant
                        │
                        ▼
                  /acme/login
                        │
                        ▼
              email + password
                        │
                        ▼
                 authenticate
                        │
                        ▼
                  issue JWT
                        │
                 ┌──────┴──────┐
                 │             │
              user_id       tenant_id
                 │             │
                 └──────┬──────┘
                        ▼
                 /acme/dashboard
                        │
                        ▼
              validate JWT + URL
                        │
                        ▼
                set RLS context
                        │
                        ▼
                   PostgreSQL

And for the JWT itself, I'd use a short-lived access token containing at least sub, tenant_id, iat, exp, and a session/token identifier if you need revocation/auditing. Keep the long-lived refresh token separate and revocable server-side.

That gives you a clean separation:

slug = routing/discovery
JWT = authenticated identity + tenant context
RLS = actual database isolation