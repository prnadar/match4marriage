"""
Import all models here so Alembic auto-detects them.
"""
from app.models.base import TenantModel
from app.models.tenant import Tenant
from app.models.user import User, UserProfile, Gender, MaritalStatus, Religion, SubscriptionTier
from app.models.personality import PersonalityScore
from app.models.match import Match, Interest, ChatThread, Message, MatchStatus, InterestStatus, MessageType
from app.models.subscription import Subscription, CreditTransaction, SubscriptionStatus, PaymentGateway
from app.models.pricing_plan import PricingPlan, PricingPeriod
from app.models.enquiry import Enquiry, EnquirySource, EnquiryStatus
from app.models.site_setting import SiteSetting
from app.models.mail_template import MailTemplate
from app.models.seo_setting import SeoSetting
from app.models.payment_gateway_config import PaymentGatewayConfig, PaymentGatewayName
from app.models.verification import Verification, VerificationType, VerificationStatus
from app.models.notification import Notification
from app.models.report import Report, ReportCategory, ReportStatus

__all__ = [
    "TenantModel",
    "Tenant",
    "User",
    "UserProfile",
    "Gender",
    "MaritalStatus",
    "Religion",
    "SubscriptionTier",
    "PersonalityScore",
    "Match",
    "Interest",
    "ChatThread",
    "Message",
    "MatchStatus",
    "InterestStatus",
    "MessageType",
    "Subscription",
    "CreditTransaction",
    "SubscriptionStatus",
    "PaymentGateway",
    "PricingPlan",
    "PricingPeriod",
    "Enquiry",
    "EnquirySource",
    "EnquiryStatus",
    "SiteSetting",
    "MailTemplate",
    "SeoSetting",
    "PaymentGatewayConfig",
    "PaymentGatewayName",
    "Verification",
    "VerificationType",
    "VerificationStatus",
    "Notification",
    "Report",
    "ReportCategory",
    "ReportStatus",
]
