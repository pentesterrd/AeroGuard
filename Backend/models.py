from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional

_NAME_MAX = 120
_TEXT_MAX = 8000


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class VerifyMFARequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)

    @field_validator("code")
    @classmethod
    def _digits(cls, v: str) -> str:
        v = (v or "").strip()
        if not v.isdigit():
            raise ValueError("MFA code must be numeric.")
        return v


class PasswordChangeRequest(BaseModel):
    email: EmailStr
    oldPassword: str = Field(min_length=1, max_length=128)
    newPassword: str = Field(min_length=8, max_length=128)


class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=_NAME_MAX)
    companyName: str = Field(max_length=_NAME_MAX)
    role: str = Field(max_length=40)
    mobile: Optional[str] = Field(default=None, max_length=30)

    @field_validator("role")
    @classmethod
    def _role(cls, v: str) -> str:
        if v not in ("admin", "internal_auditor", "vendor"):
            raise ValueError("Invalid role.")
        return v

    @field_validator("mobile")
    @classmethod
    def _mobile(cls, v):
        if v is None:
            return v
        v = v.strip()
        if v and not all(c.isdigit() or c in "+- ()" for c in v):
            raise ValueError("Mobile may contain only digits and + - ( ) characters.")
        return v


class CreateVendorRequest(BaseModel):
    email: EmailStr
    companyName: str = Field(min_length=1, max_length=_NAME_MAX)


class AddQuestionRequest(BaseModel):
    text: str = Field(min_length=1, max_length=_TEXT_MAX)
    domain: str = Field(default="General Security", max_length=_NAME_MAX)
    choice: str = Field(default="", max_length=10)        # reference Yes/No/NA
    response: str = Field(default="", max_length=_TEXT_MAX)  # reference remark


class RequestOTPRequest(BaseModel):
    email: EmailStr
    mode: str = Field(default="both", max_length=10)  # "both" (forgot) | "single" (change)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    mailOtp: str = Field(min_length=4, max_length=10)
    mobileOtp: str = Field(min_length=4, max_length=10)
    newPassword: str = Field(min_length=8, max_length=128)
    oldPassword: Optional[str] = Field(default=None, max_length=128)  # optional: verify last password too


class SecureChangePasswordRequest(BaseModel):
    email: EmailStr
    oldPassword: str = Field(min_length=1, max_length=128)
    otp: str = Field(min_length=4, max_length=10)
    newPassword: str = Field(min_length=8, max_length=128)


class HelpRequest(BaseModel):
    question: str = Field(min_length=1, max_length=_TEXT_MAX)
    domain: str = Field(default="General Security", max_length=_NAME_MAX)
