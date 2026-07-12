# EuropaDrop — Credentials

## Admin (Atlas prod DB `europadrop` — user-managed)
- **Email**: admin@creook.fr  (mot de passe géré par l'utilisateur, inconnu de l'agent)

## Admin (seed local par défaut — pour tests en sandbox)
- **Email**: admin@marcherbien.fr
- **Password**: Admin1234!
- **Role**: admin (voit toutes les données)

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
- Le preview pointe vers le **MongoDB Atlas de l'utilisateur** (`europadrop`). Pour tester sans polluer la prod, basculer temporairement `backend/.env` vers `mongodb://localhost:27017` + `DB_NAME=europadrop_sandbox`, `python seed.py`, puis restaurer Atlas.
- backend/.env et frontend/.env sont gitignored (recréés après reset d'environnement).
- pydantic-core épinglé à 2.23.4 pour matcher pydantic 2.9.2.
- Fichiers de déploiement VPS : dossier `/app/deploy/` + `docker-compose.yml` racine (EuropaDrop FastAPI+React ; les anciens fichiers Node « Babyshop » ont été supprimés).
