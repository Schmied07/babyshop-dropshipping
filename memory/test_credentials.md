# EuropaDrop — Credentials

## Admin (Atlas prod DB `europadrop` — user-managed)
- **Email**: admin@creook.fr  (mot de passe géré par l'utilisateur, inconnu de l'agent)

## QA Tester (Atlas prod DB `europadrop` — created for frontend testing, isolated operator)
- **Email**: qa.tester@europadrop.test
- **Password**: QaTest1234!
- **Role**: operator (isolated — voit uniquement ses ~12 produits jetables "QA Produit N", catégorie "QA Test")
- Seedé avec 12 produits jetables pour tester la suppression individuelle et groupée. Supprimable sans impact sur les vraies données.

## Operator réel (Atlas)
- **Email**: thierry@gmail.com (mot de passe géré par l'utilisateur, inconnu de l'agent)

## Admin (seed local par défaut — pour tests en sandbox)
- **Email**: admin@marcherbien.fr
- **Password**: Admin1234!
- **Role**: admin

## Backend URL
- Preview: voir frontend/.env REACT_APP_BACKEND_URL
- API base: {URL}/api
- Swagger: {URL}/api/docs

## WooCommerce (legacy default store, backend/.env)
- URL: https://marcherbien.fr/wp-json/wc/v3
- Consumer Key: ck_8e43e5e755581df78ed0e1b0e3ad1a86d1148271
- Consumer Secret: cs_e83d03dd16dae8d21c02a1d70089ce87a37d302a

## DeepSeek AI
- Clé dans backend/.env `DEEPSEEK_API_KEY`. Peut désormais aussi être saisie via l'UI : page Réglages → carte "Intelligence Artificielle (DeepSeek)" (admin uniquement). Stockée dans app_settings key `integrations:deepseek`, prioritaire sur le .env.

## Notes
- Preview pointe vers le MongoDB Atlas de l'utilisateur (`europadrop`).
- Qogita: identifiants live = talomthibaut@gmail.com. Intégration EN PAUSE (l'utilisateur demande l'accès API publique). API interne Qogita: pas de recherche texte REST, pas de prix stable, pas d'export webhook fiable.
