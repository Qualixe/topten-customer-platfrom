from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthUser(BaseModel):
    email: str
    name: str
    role: str
    permissions: list[str]


class LoginData(BaseModel):
    token: str
    user: AuthUser


class LoginResponse(BaseModel):
    success: bool = True
    data: LoginData
    meta: dict = {}


class MeResponse(BaseModel):
    success: bool = True
    data: AuthUser
    meta: dict = {}
