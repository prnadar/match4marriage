BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 46fb34838437

CREATE TABLE chat_threads (
    user_a_id UUID NOT NULL, 
    user_b_id UUID NOT NULL, 
    match_id UUID, 
    is_active BOOLEAN NOT NULL, 
    last_message_at TIMESTAMP WITHOUT TIME ZONE, 
    last_message_preview VARCHAR(200), 
    family_participants JSON NOT NULL, 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_thread_pair UNIQUE (tenant_id, user_a_id, user_b_id)
);

CREATE INDEX ix_chat_threads_id ON chat_threads (id);

CREATE INDEX ix_chat_threads_tenant_id ON chat_threads (tenant_id);

CREATE INDEX ix_chat_threads_user_a_id ON chat_threads (user_a_id);

CREATE INDEX ix_chat_threads_user_b_id ON chat_threads (user_b_id);

CREATE TABLE credit_transactions (
    user_id UUID NOT NULL, 
    amount INTEGER NOT NULL, 
    balance_after INTEGER NOT NULL, 
    description VARCHAR(255) NOT NULL, 
    reference_id VARCHAR(255), 
    gateway VARCHAR(50), 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_credit_transactions_id ON credit_transactions (id);

CREATE INDEX ix_credit_transactions_tenant_id ON credit_transactions (tenant_id);

CREATE INDEX ix_credit_transactions_user_id ON credit_transactions (user_id);

CREATE TYPE intereststatus AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE interests (
    sender_id UUID NOT NULL, 
    receiver_id UUID NOT NULL, 
    match_id UUID, 
    status intereststatus NOT NULL, 
    is_super_interest BOOLEAN NOT NULL, 
    message VARCHAR(500), 
    responded_at TIMESTAMP WITHOUT TIME ZONE, 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_interests_pair UNIQUE (tenant_id, sender_id, receiver_id)
);

CREATE INDEX ix_interests_id ON interests (id);

CREATE INDEX ix_interests_receiver_id ON interests (receiver_id);

CREATE INDEX ix_interests_sender_id ON interests (sender_id);

CREATE INDEX ix_interests_status ON interests (status);

CREATE INDEX ix_interests_tenant_id ON interests (tenant_id);

CREATE TYPE matchstatus AS ENUM ('PENDING', 'INTERESTED', 'MUTUAL', 'REJECTED', 'EXPIRED');

CREATE TABLE matches (
    user_a_id UUID NOT NULL, 
    user_b_id UUID NOT NULL, 
    compatibility_score FLOAT NOT NULL, 
    compatibility_breakdown JSON NOT NULL, 
    status matchstatus NOT NULL, 
    match_date VARCHAR(10) NOT NULL, 
    a_super_liked BOOLEAN NOT NULL, 
    b_super_liked BOOLEAN NOT NULL, 
    mutual_at TIMESTAMP WITHOUT TIME ZONE, 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_matches_pair UNIQUE (tenant_id, user_a_id, user_b_id)
);

CREATE INDEX ix_matches_id ON matches (id);

CREATE INDEX ix_matches_match_date ON matches (match_date);

CREATE INDEX ix_matches_status ON matches (status);

CREATE INDEX ix_matches_tenant_id ON matches (tenant_id);

CREATE INDEX ix_matches_user_a_id ON matches (user_a_id);

CREATE INDEX ix_matches_user_b_id ON matches (user_b_id);

CREATE TYPE messagetype AS ENUM ('TEXT', 'VOICE', 'IMAGE', 'ICEBREAKER', 'SYSTEM');

CREATE TABLE messages (
    thread_id UUID NOT NULL, 
    sender_id UUID NOT NULL, 
    message_type messagetype NOT NULL, 
    encrypted_content TEXT, 
    encryption_key_id VARCHAR(100), 
    media_key VARCHAR(500), 
    media_duration_seconds INTEGER, 
    delivered_at TIMESTAMP WITHOUT TIME ZONE, 
    read_at TIMESTAMP WITHOUT TIME ZONE, 
    is_deleted_for_sender BOOLEAN NOT NULL, 
    is_deleted_for_receiver BOOLEAN NOT NULL, 
    moderation_score FLOAT, 
    is_flagged BOOLEAN NOT NULL, 
    moderation_action VARCHAR(50), 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_messages_id ON messages (id);

CREATE INDEX ix_messages_sender_id ON messages (sender_id);

CREATE INDEX ix_messages_tenant_id ON messages (tenant_id);

CREATE INDEX ix_messages_thread_id ON messages (thread_id);

CREATE TABLE personality_scores (
    user_id UUID NOT NULL, 
    openness FLOAT, 
    conscientiousness FLOAT, 
    extraversion FLOAT, 
    agreeableness FLOAT, 
    neuroticism FLOAT, 
    values_score FLOAT, 
    lifestyle_score FLOAT, 
    family_expectations_score FLOAT, 
    ambition_score FLOAT, 
    communication_style_score FLOAT, 
    quiz_responses JSON NOT NULL, 
    pinecone_vector_id VARCHAR(100), 
    quiz_version VARCHAR(10) NOT NULL, 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_personality_scores_id ON personality_scores (id);

CREATE INDEX ix_personality_scores_tenant_id ON personality_scores (tenant_id);

CREATE UNIQUE INDEX ix_personality_scores_user_id ON personality_scores (user_id);

CREATE TYPE gender AS ENUM ('MALE', 'FEMALE', 'OTHER');

CREATE TYPE maritalstatus AS ENUM ('NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED');

CREATE TYPE religion AS ENUM ('HINDU', 'MUSLIM', 'CHRISTIAN', 'SIKH', 'JAIN', 'BUDDHIST', 'PARSI', 'JEWISH', 'OTHER');

CREATE TABLE profiles (
    user_id UUID NOT NULL, 
    first_name VARCHAR(100) NOT NULL, 
    last_name VARCHAR(100) NOT NULL, 
    date_of_birth DATE, 
    gender gender, 
    marital_status maritalstatus NOT NULL, 
    city VARCHAR(100), 
    state VARCHAR(100), 
    country VARCHAR(100) NOT NULL, 
    pincode VARCHAR(10), 
    religion religion, 
    caste VARCHAR(200), 
    sub_caste VARCHAR(200), 
    mother_tongue VARCHAR(100), 
    languages JSON NOT NULL, 
    height_cm SMALLINT, 
    weight_kg SMALLINT, 
    complexion VARCHAR(50), 
    body_type VARCHAR(50), 
    education_level VARCHAR(100), 
    education_field VARCHAR(200), 
    college VARCHAR(200), 
    occupation VARCHAR(200), 
    employer VARCHAR(200), 
    annual_income_inr BIGINT, 
    bio TEXT, 
    about_family TEXT, 
    photos JSON NOT NULL, 
    intro_videos JSON NOT NULL, 
    voice_note_key VARCHAR(500), 
    partner_prefs JSON NOT NULL, 
    family_details JSON NOT NULL, 
    birth_time VARCHAR(10), 
    birth_place VARCHAR(200), 
    is_manglik BOOLEAN, 
    kundali_data JSON NOT NULL, 
    visa_status VARCHAR(100), 
    willing_to_relocate BOOLEAN NOT NULL, 
    completeness_score SMALLINT NOT NULL, 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_profiles_id ON profiles (id);

CREATE INDEX ix_profiles_tenant_id ON profiles (tenant_id);

CREATE UNIQUE INDEX ix_profiles_user_id ON profiles (user_id);

CREATE TYPE reportcategory AS ENUM ('FAKE_PROFILE', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'SPAM', 'FRAUD', 'ABUSIVE_LANGUAGE', 'UNDERAGE', 'IMPERSONATION', 'PRIVACY_VIOLATION', 'SCAM', 'UNSOLICITED_CONTACT', 'OTHER');

CREATE TYPE reportstatus AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_ACTION_TAKEN', 'RESOLVED_NO_ACTION', 'DISMISSED');

CREATE TABLE reports (
    reporter_id UUID NOT NULL, 
    reported_user_id UUID NOT NULL, 
    category reportcategory NOT NULL, 
    description TEXT, 
    evidence JSON NOT NULL, 
    status reportstatus NOT NULL, 
    admin_id UUID, 
    admin_notes TEXT, 
    resolved_at TIMESTAMP WITHOUT TIME ZONE, 
    action_taken VARCHAR(100), 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_reports_id ON reports (id);

CREATE INDEX ix_reports_reported_user_id ON reports (reported_user_id);

CREATE INDEX ix_reports_reporter_id ON reports (reporter_id);

CREATE INDEX ix_reports_status ON reports (status);

CREATE INDEX ix_reports_tenant_id ON reports (tenant_id);

CREATE TYPE subscriptionstatus AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'PAST_DUE');

CREATE TYPE paymentgateway AS ENUM ('RAZORPAY', 'STRIPE', 'UPI');

CREATE TABLE subscriptions (
    user_id UUID NOT NULL, 
    plan VARCHAR(50) NOT NULL, 
    status subscriptionstatus NOT NULL, 
    gateway paymentgateway NOT NULL, 
    gateway_subscription_id VARCHAR(255), 
    gateway_customer_id VARCHAR(255), 
    amount_paise BIGINT NOT NULL, 
    currency VARCHAR(3) NOT NULL, 
    current_period_start TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    current_period_end TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    cancelled_at TIMESTAMP WITHOUT TIME ZONE, 
    monthly_interests INTEGER NOT NULL, 
    monthly_contacts INTEGER NOT NULL, 
    monthly_video_calls INTEGER NOT NULL, 
    raw_webhook_data JSON NOT NULL, 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_subscriptions_id ON subscriptions (id);

CREATE INDEX ix_subscriptions_tenant_id ON subscriptions (tenant_id);

CREATE INDEX ix_subscriptions_user_id ON subscriptions (user_id);

CREATE TABLE tenants (
    id UUID NOT NULL, 
    slug VARCHAR(100) NOT NULL, 
    name VARCHAR(200) NOT NULL, 
    domain VARCHAR(255), 
    branding JSON NOT NULL, 
    features JSON NOT NULL, 
    plan VARCHAR(50) NOT NULL, 
    max_users INTEGER NOT NULL, 
    razorpay_account_id VARCHAR(255), 
    stripe_account_id VARCHAR(255), 
    is_active BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (domain)
);

CREATE UNIQUE INDEX ix_tenants_slug ON tenants (slug);

CREATE TYPE subscriptiontier AS ENUM ('FREE', 'SILVER', 'GOLD', 'PLATINUM');

CREATE TABLE users (
    auth0_sub VARCHAR(255), 
    phone VARCHAR(15) NOT NULL, 
    email VARCHAR(255), 
    aadhaar_hash VARCHAR(64), 
    pan_hash VARCHAR(64), 
    trust_score SMALLINT NOT NULL, 
    subscription_tier subscriptiontier NOT NULL, 
    interests_remaining INTEGER NOT NULL, 
    contact_unlocks_remaining INTEGER NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    is_phone_verified BOOLEAN NOT NULL, 
    is_email_verified BOOLEAN NOT NULL, 
    is_profile_complete BOOLEAN NOT NULL, 
    last_active_at TIMESTAMP WITHOUT TIME ZONE, 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_users_tenant_auth0 UNIQUE (tenant_id, auth0_sub), 
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email), 
    CONSTRAINT uq_users_tenant_phone UNIQUE (tenant_id, phone)
);

CREATE INDEX ix_users_auth0_sub ON users (auth0_sub);

CREATE INDEX ix_users_email ON users (email);

CREATE INDEX ix_users_id ON users (id);

CREATE INDEX ix_users_phone ON users (phone);

CREATE INDEX ix_users_tenant_id ON users (tenant_id);

CREATE TYPE verificationtype AS ENUM ('MOBILE_OTP', 'EMAIL', 'AADHAAR', 'PAN', 'PHOTO_LIVENESS', 'DIGILOCKER_EDUCATION', 'LINKEDIN', 'EMPLOYMENT');

CREATE TYPE verificationstatus AS ENUM ('PENDING', 'IN_REVIEW', 'VERIFIED', 'FAILED', 'EXPIRED');

CREATE TABLE verifications (
    user_id UUID NOT NULL, 
    verification_type verificationtype NOT NULL, 
    status verificationstatus NOT NULL, 
    external_ref_id VARCHAR(255), 
    verified_at TIMESTAMP WITHOUT TIME ZONE, 
    expires_at TIMESTAMP WITHOUT TIME ZONE, 
    provider_response JSON NOT NULL, 
    trust_points INTEGER NOT NULL, 
    id UUID NOT NULL, 
    tenant_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    deleted_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_verification_user_type UNIQUE (tenant_id, user_id, verification_type)
);

CREATE INDEX ix_verifications_id ON verifications (id);

CREATE INDEX ix_verifications_tenant_id ON verifications (tenant_id);

CREATE INDEX ix_verifications_user_id ON verifications (user_id);

INSERT INTO alembic_version (version_num) VALUES ('46fb34838437') RETURNING alembic_version.version_num;

COMMIT;

