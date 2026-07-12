# EuropaDrop — Credentials

## Admin (superadmin, seeded)
- **Email**: admin@marcherbien.fr
- **Password**: Admin1234!
- **Role**: admin

## Operator (test user, created via /api/users)
- **Email**: operator@marcherbien.fr
- **Password**: Op1234!
- **Role**: operator

## Backend URL
- Preview: https://command-palette-8.preview.emergentagent.com
- API base: {URL}/api
- Swagger: {URL}/api/docs
- OpenAPI JSON: {URL}/api/openapi.json

## WooCommerce (legacy default store, .env)
- URL: https://marcherbien.fr/wp-json/wc/v3
- Consumer Key: ck_8e43e5e755581df78ed0e1b0e3ad1a86d1148271
- Consumer Secret: cs_e83d03dd16dae8d21c02a1d70089ce87a37d302a

## DeepSeek AI
- **Key**: sk-5c53750be5d5474ba56b9480094433e6
- **Status**: ⚠️ Renvoie 401 "invalid api key" — à renouveler sur https://platform.deepseek.com/api_keys

## Webhook secret
- Auto-géré en DB (collection `app_settings`, key=`webhook_secret`)
- Régénérable via UI `/automatisations` bouton "Régénérer & enregistrer"

## API Keys (exemples créés lors des tests)
- Prefix `ed_...` — voir table dans `/cles-api`
