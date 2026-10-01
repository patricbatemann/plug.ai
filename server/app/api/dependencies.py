import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.services.auth import get_user_by_email

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise credentials_error
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        email = payload.get("sub")
        if not isinstance(email, str):
            raise credentials_error
    except jwt.InvalidTokenError as error:
        raise credentials_error from error

    user = get_user_by_email(db, email)
    if user is None:
        raise credentials_error
    return user
