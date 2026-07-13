"""JWT auth utilities + API key support."""
import os
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_access_token(user_id: str, email: str, role: str = "admin", isolation_mode: bool = False) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "email": email, "role": role, "isolationMode": isolation_mode, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """Accept JWT tokens AND API keys (ed_ prefix)."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Non authentifié")

    token = credentials.credentials
    db = request.app.state.db

    # API key path
    if token.startswith("ed_"):
        key_hash = hashlib.sha256(token.encode()).hexdigest()
        api_key = await db.api_keys.find_one({"key_hash": key_hash, "revoked": {"$ne": True}})
        if not api_key:
            raise HTTPException(status_code=401, detail="Clé API invalide ou révoquée")
        await db.api_keys.update_one(
            {"_id": api_key["_id"]},
            {"$set": {"lastUsedAt": datetime.now(timezone.utc)}},
        )
        return {
            "id": str(api_key["_id"]),
            "email": f"apikey:{api_key.get('name','')}",
            "role": "api_key",
            "scopes": api_key.get("scopes", []),
            "name": api_key.get("name", ""),
        }

    # JWT path
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "id": payload["sub"], "email": payload["email"],
            "role": payload.get("role", "admin"),
            "isolationMode": payload.get("isolationMode", False),
            "scopes": ["*"],
        }
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")

