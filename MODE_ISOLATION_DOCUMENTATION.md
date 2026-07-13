# Mode Isolation Admin — Documentation

## 🎯 Problème résolu

**Situation initiale :**
- Les admins voient les données de TOUS les utilisateurs (normal pour un admin)
- Cela crée de l'interférence quand l'admin veut travailler sur SES propres données
- Problème : si l'admin importe un catalogue, un autre utilisateur ne peut pas importer le même catalogue (conflit)
- Besoin : système permettant à l'admin de choisir son mode de travail

**Solution implémentée :**
Un toggle **Mode Isolation** permettant à l'admin de basculer entre :
- 🔓 **Mode Supervision** (défaut) : voir toutes les données (tous les utilisateurs)
- 🔒 **Mode Isolation** : voir uniquement SES propres données (travail personnel)

---

## ✨ Fonctionnalités

### Pour les Admins

**Mode Supervision (🔓 défaut) :**
- Voit tous les produits, commandes, fournisseurs de tous les utilisateurs
- Les nouvelles données créées sont globales (pas d'ownerId)
- Utile pour supervision, support, gestion d'équipe

**Mode Isolation (🔒) :**
- Voit UNIQUEMENT ses propres données (comme un utilisateur normal)
- Les nouvelles données créées ont un ownerId = admin
- Aucune interférence avec les autres utilisateurs
- Peut importer les mêmes catalogues qu'un autre utilisateur sans conflit

### Pour les Utilisateurs non-admin

- **Toujours** en mode isolation (par défaut)
- Ne voient que leurs propres données
- Pas d'accès au toggle (réservé aux admins)

---

## 🔧 Architecture technique

### Backend

#### 1. **Nouveau champ User : `isolationMode`**
```python
# Collection users
{
  "_id": ObjectId,
  "email": "admin@example.com",
  "name": "Admin",
  "role": "admin",
  "isolationMode": false,  # ← Nouveau champ (défaut: false)
  "created_at": datetime
}
```

#### 2. **JWT Token enrichi**
```python
# auth.py - create_access_token()
payload = {
  "sub": user_id,
  "email": email,
  "role": role,
  "isolationMode": isolation_mode,  # ← Nouveau champ dans le token
  "exp": expire
}
```

#### 3. **Scoping modifié**
```python
# server.py - scope_q()
def scope_q(current: dict, base: Optional[dict] = None) -> dict:
    q = dict(base or {})
    # Admin en mode isolation OU utilisateur non-admin
    if current.get("isolationMode") or (current.get("role") not in ("admin", "api_key")):
        q["ownerId"] = current.get("id")  # ← Filtre sur ownerId
    # Sinon (admin en mode supervision) : pas de filtre → voit tout
    return q

# server.py - set_owner()
def set_owner(doc: dict, current: dict) -> dict:
    # Admin en mode isolation OU utilisateur non-admin
    if current.get("isolationMode") or (current.get("role") not in ("admin", "api_key")):
        doc["ownerId"] = current.get("id")  # ← Définit ownerId
    # Sinon (admin en mode supervision) : pas d'ownerId → data globale
    return doc
```

#### 4. **Nouveaux endpoints**

**GET /api/auth/isolation-status**
```json
Response (admin):
{
  "available": true,
  "isolationMode": false,
  "message": "En mode supervision, vous voyez toutes les données"
}

Response (non-admin):
{
  "available": false,
  "isolationMode": false,
  "message": "Mode isolation réservé aux admins"
}
```

**POST /api/auth/toggle-isolation** (admin uniquement)
```json
Response:
{
  "success": true,
  "isolationMode": true,
  "token": "eyJ...",  // Nouveau token avec isolationMode=true
  "message": "Mode isolation activé — Vous ne voyez que vos données"
}
```

---

### Frontend

#### 1. **Toggle UI dans la sidebar** (Layout.jsx)

```jsx
{user?.role === "admin" && (
  <button onClick={toggleIsolation} className={isolationMode ? "active" : ""}>
    {isolationMode ? <LockSimple /> : <LockSimpleOpen />}
    <div>
      {isolationMode ? "Mode Isolation" : "Mode Supervision"}
      <small>{isolationMode ? "Vos données uniquement" : "Toutes les données"}</small>
    </div>
  </button>
)}
```

**Apparence :**
- 🔒 Mode Isolation : bouton bleu avec bordure, texte "Vos données uniquement"
- 🔓 Mode Supervision : bouton gris, texte "Toutes les données"

#### 2. **Fonction toggle**

```javascript
const toggleIsolation = async () => {
  const r = await api.post("/auth/toggle-isolation");
  setIsolationMode(r.data.isolationMode);
  setToken(r.data.token);  // Met à jour le token
  toast.success(r.data.message);
  window.location.reload();  // Refresh pour appliquer le nouveau scope
};
```

#### 3. **Hook auth enrichi** (auth.js)

```javascript
export function AuthProvider({ children }) {
  const setToken = (newToken) => {
    localStorage.setItem("mb_token", newToken);
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout, loading, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 📋 Fichiers modifiés

### Backend
1. **`/app/backend/auth.py`** :
   - `create_access_token()` : ajout paramètre `isolation_mode`
   - `get_current_user()` : extraction `isolationMode` du JWT

2. **`/app/backend/server.py`** :
   - `scope_q()` : respect du mode isolation
   - `set_owner()` : définit ownerId si mode isolation
   - `owned_ids_set()` : filtre si mode isolation
   - `register()` : init `isolationMode=False` pour nouveaux users
   - `login()` : récupère `isolationMode` de la DB et l'inclut dans le token
   - Nouveaux endpoints :
     - `GET /api/auth/isolation-status`
     - `POST /api/auth/toggle-isolation`

### Frontend
3. **`/app/frontend/src/components/Layout.jsx`** :
   - Import `LockSimple`, `LockSimpleOpen` icons
   - State `isolationMode`, `isolationLoading`
   - Fonction `toggleIsolation()`
   - UI toggle dans la sidebar

4. **`/app/frontend/src/lib/auth.js`** :
   - Fonction `setToken()` exportée dans le context

---

## 🧪 Scénarios de test

### Test 1 : Admin en mode supervision (défaut)
```
1. Se connecter en tant qu'admin
2. Vérifier bouton "Mode Supervision" (gris) visible dans la sidebar
3. Aller sur /catalogue
4. RÉSULTAT : voit tous les produits de tous les utilisateurs
5. Créer un nouveau produit
6. RÉSULTAT : produit créé sans ownerId (global)
```

### Test 2 : Basculer en mode isolation
```
1. Cliquer sur le bouton "Mode Supervision"
2. RÉSULTAT : 
   - Toast "Mode isolation activé — Vous ne voyez que vos données"
   - Page se rafraîchit
   - Bouton devient "Mode Isolation" (bleu)
3. Aller sur /catalogue
4. RÉSULTAT : voit uniquement SES propres produits
5. Créer un nouveau produit
6. RÉSULTAT : produit créé avec ownerId = admin_id
```

### Test 3 : Import catalogue sans conflit
```
Setup : 
  - User A (non-admin) importe catalogue Qogita
  - Admin en mode supervision essaie d'importer le même catalogue
  - AVANT fix : conflit (produits déjà existants)

Test :
1. Admin clique sur "Mode Supervision" → passe en "Mode Isolation"
2. Admin va sur /import
3. Admin importe le même catalogue Qogita
4. RÉSULTAT : import réussit, produits créés avec ownerId=admin
5. User A et Admin ont chacun leurs propres produits Qogita (isolés)
```

### Test 4 : Utilisateur non-admin
```
1. Se connecter en tant qu'utilisateur (role=operator)
2. RÉSULTAT : pas de bouton isolation dans la sidebar (réservé aux admins)
3. Aller sur /catalogue
4. RÉSULTAT : voit uniquement ses propres produits (isolation par défaut)
```

### Test 5 : Persistance du mode
```
1. Admin active le mode isolation
2. Se déconnecter
3. Se reconnecter
4. RÉSULTAT : le mode isolation est toujours actif (persisté en DB)
```

---

## 🎨 UI/UX

### Position du toggle
- **Emplacement** : Sidebar, entre la navigation et la section utilisateur
- **Visibilité** : Uniquement pour les admins (role=admin)
- **Accessibilité** : `data-testid="isolation-toggle-btn"`

### États visuels

**Mode Supervision (défaut) :**
```
┌──────────────────────────────────┐
│ 🔓 Mode Supervision              │
│    Toutes les données            │
└──────────────────────────────────┘
Couleur : Gris (bg-zinc-800/50)
```

**Mode Isolation :**
```
┌──────────────────────────────────┐
│ 🔒 Mode Isolation                │
│    Vos données uniquement        │
└──────────────────────────────────┘
Couleur : Bleu (bg-blue-500/10)
```

### Feedback utilisateur
- **Toggle** : Toast de confirmation immédiat
- **Refresh** : Page se rafraîchit automatiquement pour appliquer le nouveau scope
- **Badge visuel** : Indication claire du mode actif

---

## ⚠️ Notes importantes

### Limitations

1. **API Keys** : Les clés API ne sont **pas affectées** par le mode isolation. Elles voient toujours toutes les données (role=api_key).

2. **Refresh nécessaire** : Après toggle, la page se rafraîchit pour recharger les données avec le nouveau scope. Cela garantit la cohérence.

3. **Migration existante** : Les utilisateurs existants auront `isolationMode=false` par défaut (mode supervision). Aucune migration DB nécessaire (champ ajouté à la volée).

### Bonnes pratiques

**Quand utiliser le mode isolation ?**
- ✅ Travail personnel de l'admin (imports, création de produits)
- ✅ Tests sans affecter les autres utilisateurs
- ✅ Développement/sandbox

**Quand utiliser le mode supervision ?**
- ✅ Support client (voir les données d'un utilisateur)
- ✅ Gestion d'équipe (vue d'ensemble)
- ✅ Analytics globales

---

## 🚀 Impact

### Avant
- ❌ Admin voit tout en permanence → interférence
- ❌ Impossible d'importer le même catalogue qu'un autre user
- ❌ Confusion sur les données personnelles vs globales

### Après
- ✅ Admin contrôle son scope d'un clic
- ✅ Chaque user (admin inclus) peut importer ses propres catalogues
- ✅ Isolation claire : données perso vs données globales
- ✅ Flexibilité : supervision quand nécessaire, isolation pour le travail

---

## 📊 Déploiement

Services redémarrés :
```bash
sudo supervisorctl restart backend frontend
# → RUNNING ✅
```

Aucune migration DB nécessaire :
- Champ `isolationMode` ajouté automatiquement à la création de nouveaux users
- Users existants auront `isolationMode=false` par défaut (comportement actuel préservé)

---

## 🔍 Debugging

### Vérifier le mode actuel
```bash
# Backend logs
tail -f /var/log/supervisor/backend.out.log | grep isolation

# API check
curl -H "Authorization: Bearer <token>" https://APP_URL/api/auth/isolation-status
```

### Tester manuellement le toggle
```bash
# Toggle
curl -X POST https://APP_URL/api/auth/toggle-isolation \
  -H "Authorization: Bearer <admin_token>"

# Response
{
  "success": true,
  "isolationMode": true,
  "token": "eyJ...",
  "message": "Mode isolation activé"
}
```

### Vérifier le JWT
```python
import jwt
token = "eyJ..."
payload = jwt.decode(token, options={"verify_signature": False})
print(payload.get("isolationMode"))  # True ou False
```

---

## ✅ Validation finale

**Backend :**
- ✅ Champ `isolationMode` ajouté dans users
- ✅ JWT enrichi avec `isolationMode`
- ✅ `scope_q()` et `set_owner()` modifiés
- ✅ Endpoints `/auth/isolation-status` et `/auth/toggle-isolation` créés
- ✅ Login/register mis à jour

**Frontend :**
- ✅ Toggle UI dans la sidebar
- ✅ État `isolationMode` géré
- ✅ Fonction `setToken()` ajoutée au context
- ✅ Refresh automatique après toggle

**Tests :**
- ✅ Mode supervision : admin voit tout
- ✅ Mode isolation : admin voit uniquement ses données
- ✅ Import catalogue sans conflit
- ✅ Persistance du mode après déconnexion/reconnexion
