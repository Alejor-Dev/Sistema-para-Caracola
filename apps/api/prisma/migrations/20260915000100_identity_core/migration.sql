CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY,
  "username" VARCHAR(80) NOT NULL UNIQUE,
  "display_name" VARCHAR(120) NOT NULL,
  "email" VARCHAR(255) UNIQUE,
  "password_hash" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "failed_login_count" INTEGER NOT NULL DEFAULT 0 CHECK ("failed_login_count" >= 0),
  "locked_until" TIMESTAMPTZ(3),
  "last_login_at" TIMESTAMPTZ(3),
  "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "archived_at" TIMESTAMPTZ(3)
);

CREATE TABLE "roles" (
  "id" UUID PRIMARY KEY,
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "archived_at" TIMESTAMPTZ(3)
);

CREATE TABLE "permissions" (
  "id" UUID PRIMARY KEY,
  "code" VARCHAR(120) NOT NULL UNIQUE,
  "module" VARCHAR(80) NOT NULL,
  "description" TEXT NOT NULL
);

CREATE TABLE "user_roles" (
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
  "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "role_id")
);

CREATE TABLE "role_permissions" (
  "role_id" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission_id" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE RESTRICT,
  PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "sessions" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" CHAR(64) NOT NULL UNIQUE,
  "ip" VARCHAR(64),
  "user_agent" VARCHAR(512),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "revoke_reason" VARCHAR(160)
);

CREATE TABLE "audit_logs" (
  "id" UUID PRIMARY KEY,
  "actor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "action" VARCHAR(120) NOT NULL,
  "entity_type" VARCHAR(100) NOT NULL,
  "entity_id" VARCHAR(100),
  "before_data" JSONB,
  "after_data" JSONB,
  "ip" VARCHAR(64),
  "user_agent" VARCHAR(512),
  "request_id" VARCHAR(100),
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at" DESC);
CREATE INDEX "audit_logs_actor_user_id_occurred_at_idx" ON "audit_logs"("actor_user_id", "occurred_at" DESC);
CREATE INDEX "audit_logs_entity_type_entity_id_occurred_at_idx" ON "audit_logs"("entity_type", "entity_id", "occurred_at" DESC);
