# EuropaDrop — Credentials

## Admin (superadmin, seeded)
- **Email**: admin@marcherbien.fr
- **Password**: Admin1234!
- **Role**: admin (sees ALL data across users)

## Operator (test user — create via POST /api/users as admin if missing)
- **Email**: operator@marcherbien.fr
- **Password**: Op1234!
- **Role**: operator (isolated: sees only its own stores/products/orders)

## Backend URL
- Preview: https://command-palette-8.preview.emergentagent.com
- API base: {URL}/api
- Swagger: {URL}/api/docs

## WooCommerce (legacy default store, backend/.env)
- URL: https://marcherbien.fr/wp-json/wc/v3
- Consumer Key: ck_8e43e5e755581df78ed0e1b0e3ad1a86d1148271
- Consumer Secret: cs_e83d03dd16dae8d21c02a1d70089ce87a37d302a

## DeepSeek AI
- **Key**: EMPTY (DEEPSEEK_API_KEY not set) — AI endpoints return graceful "non configuré".
- Bulk AI action returns {success:false, configured:false, message:...} when key missing (by design).

## Notes
- backend/.env and frontend/.env were recreated after an environment reset (they are gitignored).
- pydantic-core pinned to 2.23.4 to match pydantic 2.9.2.
