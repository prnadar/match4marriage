"""
PaymentGatewayConfig — admin-managed gateway credentials.

One row per (tenant, gateway). Secrets are write-only via the API: GET never
returns `secret_key` or `webhook_secret` raw, only a `configured` boolean and
the last 4 chars (`secret_tail`) so admins can confirm what they've set.

Storage note: in this PR we store the secrets in plaintext columns. A follow-up
should layer encryption (cryptography.fernet with a KMS-managed key) over the
read/write paths so a DB dump alone cannot leak credentials. This model is
designed so adding that layer later is a single-file change.
"""
import enum
import uuid

from sqlalchemy import Boolean, Enum, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TenantModel


class PaymentGatewayName(str, enum.Enum):
    RAZORPAY = "razorpay"
    STRIPE = "stripe"
    UPI = "upi"


class PaymentGatewayConfig(TenantModel):
    __tablename__ = "payment_gateway_configs"
    __table_args__ = (
        UniqueConstraint("tenant_id", "gateway", name="uq_payment_gateway_tenant_name"),
    )

    gateway: Mapped[PaymentGatewayName] = mapped_column(
        Enum(PaymentGatewayName), nullable=False, index=True,
    )

    # Public identifier (Razorpay key_id, Stripe publishable key, UPI VPA, etc.)
    publishable_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Secret — never returned by the API.
    secret_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Webhook signing secret — never returned by the API.
    webhook_secret: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Mode flags. `is_test_mode` lets admins point at sandbox endpoints.
    is_test_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
