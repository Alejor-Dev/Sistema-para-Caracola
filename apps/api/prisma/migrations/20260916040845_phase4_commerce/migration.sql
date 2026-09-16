-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('CONFIRMED', 'PARTIALLY_RETURNED', 'RETURNED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('CONFIRMED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('RETURN', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "SettlementType" AS ENUM ('COLLECTION', 'REFUND');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_role_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "first_name" VARCHAR(120) NOT NULL,
    "last_name" VARCHAR(120),
    "document_id" VARCHAR(30),
    "phone" VARCHAR(50),
    "whatsapp" VARCHAR(50),
    "email" VARCHAR(255),
    "address" VARCHAR(300),
    "birth_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "number" BIGSERIAL NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "customer_id" UUID,
    "user_id" UUID NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'CONFIRMED',
    "subtotal_amount" DECIMAL(19,4) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "cost_amount" DECIMAL(19,4) NOT NULL,
    "profit_amount" DECIMAL(19,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'ARS',
    "notes" TEXT,
    "confirmed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by" UUID,
    "void_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name" VARCHAR(180) NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "variant_description" VARCHAR(240),
    "quantity" INTEGER NOT NULL,
    "unit_price_amount" DECIMAL(19,4) NOT NULL,
    "unit_cost_amount" DECIMAL(19,4) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total_amount" DECIMAL(19,4) NOT NULL,
    "returned_quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_payments" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "payment_method_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference" VARCHAR(160),

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_purchases" (
    "id" UUID NOT NULL,
    "number" BIGSERIAL NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'CONFIRMED',
    "total_amount" DECIMAL(19,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'ARS',
    "notes" TEXT,
    "confirmed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_purchase_items" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name" VARCHAR(180) NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost_amount" DECIMAL(19,4) NOT NULL,
    "line_total_amount" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "supplier_purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_purchase_payments" (
    "id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "payment_method_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference" VARCHAR(160),

    CONSTRAINT "supplier_purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_transactions" (
    "id" UUID NOT NULL,
    "number" BIGSERIAL NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "sale_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ReturnType" NOT NULL,
    "refund_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "replacement_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "difference_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" CHAR(3) NOT NULL DEFAULT 'ARS',
    "reason" VARCHAR(500) NOT NULL,
    "notes" TEXT,
    "confirmed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_items" (
    "id" UUID NOT NULL,
    "return_transaction_id" UUID NOT NULL,
    "sale_item_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_amount" DECIMAL(19,4) NOT NULL,
    "refund_amount" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_items" (
    "id" UUID NOT NULL,
    "return_transaction_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name" VARCHAR(180) NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_amount" DECIMAL(19,4) NOT NULL,
    "line_total_amount" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "exchange_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_settlements" (
    "id" UUID NOT NULL,
    "return_transaction_id" UUID NOT NULL,
    "payment_method_id" UUID NOT NULL,
    "type" "SettlementType" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference" VARCHAR(160),

    CONSTRAINT "return_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_document_id_key" ON "customers"("document_id");

-- CreateIndex
CREATE INDEX "customers_last_name_first_name_idx" ON "customers"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE INDEX "payment_methods_is_active_sort_order_idx" ON "payment_methods"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "sales_number_key" ON "sales"("number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_idempotency_key_key" ON "sales"("idempotency_key");

-- CreateIndex
CREATE INDEX "sales_confirmed_at_idx" ON "sales"("confirmed_at" DESC);

-- CreateIndex
CREATE INDEX "sales_customer_id_confirmed_at_idx" ON "sales"("customer_id", "confirmed_at" DESC);

-- CreateIndex
CREATE INDEX "sales_user_id_confirmed_at_idx" ON "sales"("user_id", "confirmed_at" DESC);

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_variant_id_idx" ON "sale_items"("variant_id");

-- CreateIndex
CREATE INDEX "sale_payments_sale_id_idx" ON "sale_payments"("sale_id");

-- CreateIndex
CREATE INDEX "sale_payments_payment_method_id_idx" ON "sale_payments"("payment_method_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_purchases_number_key" ON "supplier_purchases"("number");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_purchases_idempotency_key_key" ON "supplier_purchases"("idempotency_key");

-- CreateIndex
CREATE INDEX "supplier_purchases_supplier_id_confirmed_at_idx" ON "supplier_purchases"("supplier_id", "confirmed_at" DESC);

-- CreateIndex
CREATE INDEX "supplier_purchases_confirmed_at_idx" ON "supplier_purchases"("confirmed_at" DESC);

-- CreateIndex
CREATE INDEX "supplier_purchase_items_purchase_id_idx" ON "supplier_purchase_items"("purchase_id");

-- CreateIndex
CREATE INDEX "supplier_purchase_items_variant_id_idx" ON "supplier_purchase_items"("variant_id");

-- CreateIndex
CREATE INDEX "supplier_purchase_payments_purchase_id_idx" ON "supplier_purchase_payments"("purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_transactions_number_key" ON "return_transactions"("number");

-- CreateIndex
CREATE UNIQUE INDEX "return_transactions_idempotency_key_key" ON "return_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "return_transactions_sale_id_confirmed_at_idx" ON "return_transactions"("sale_id", "confirmed_at" DESC);

-- CreateIndex
CREATE INDEX "return_transactions_confirmed_at_idx" ON "return_transactions"("confirmed_at" DESC);

-- CreateIndex
CREATE INDEX "return_items_return_transaction_id_idx" ON "return_items"("return_transaction_id");

-- CreateIndex
CREATE INDEX "return_items_sale_item_id_idx" ON "return_items"("sale_item_id");

-- CreateIndex
CREATE INDEX "exchange_items_return_transaction_id_idx" ON "exchange_items"("return_transaction_id");

-- CreateIndex
CREATE INDEX "exchange_items_variant_id_idx" ON "exchange_items"("variant_id");

-- CreateIndex
CREATE INDEX "return_settlements_return_transaction_id_idx" ON "return_settlements"("return_transaction_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_purchases" ADD CONSTRAINT "supplier_purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_purchases" ADD CONSTRAINT "supplier_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_purchase_items" ADD CONSTRAINT "supplier_purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "supplier_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_purchase_items" ADD CONSTRAINT "supplier_purchase_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_purchase_payments" ADD CONSTRAINT "supplier_purchase_payments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "supplier_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_purchase_payments" ADD CONSTRAINT "supplier_purchase_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_transactions" ADD CONSTRAINT "return_transactions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_transactions" ADD CONSTRAINT "return_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_transaction_id_fkey" FOREIGN KEY ("return_transaction_id") REFERENCES "return_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_items" ADD CONSTRAINT "exchange_items_return_transaction_id_fkey" FOREIGN KEY ("return_transaction_id") REFERENCES "return_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_items" ADD CONSTRAINT "exchange_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_return_transaction_id_fkey" FOREIGN KEY ("return_transaction_id") REFERENCES "return_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Database-level commercial invariants. Application validation remains the
-- user-friendly first line; these constraints prevent inconsistent writes by
-- any future integration or maintenance script.
ALTER TABLE "sales" ADD CONSTRAINT "sales_amounts_check" CHECK (
  subtotal_amount >= 0 AND discount_amount >= 0 AND total_amount >= 0 AND
  cost_amount >= 0 AND total_amount = subtotal_amount - discount_amount AND
  profit_amount = total_amount - cost_amount
);
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_amounts_check" CHECK (
  quantity > 0 AND returned_quantity >= 0 AND returned_quantity <= quantity AND
  unit_price_amount >= 0 AND unit_cost_amount >= 0 AND discount_amount >= 0 AND
  line_total_amount >= 0 AND line_total_amount = (unit_price_amount * quantity) - discount_amount
);
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_amount_check" CHECK (amount > 0);
ALTER TABLE "supplier_purchases" ADD CONSTRAINT "supplier_purchases_total_check" CHECK (total_amount >= 0);
ALTER TABLE "supplier_purchase_items" ADD CONSTRAINT "supplier_purchase_items_amounts_check" CHECK (
  quantity > 0 AND unit_cost_amount >= 0 AND line_total_amount = unit_cost_amount * quantity
);
ALTER TABLE "supplier_purchase_payments" ADD CONSTRAINT "supplier_purchase_payments_amount_check" CHECK (amount > 0);
ALTER TABLE "return_transactions" ADD CONSTRAINT "return_transactions_amounts_check" CHECK (
  refund_amount >= 0 AND replacement_amount >= 0 AND difference_amount = replacement_amount - refund_amount
);
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_amounts_check" CHECK (
  quantity > 0 AND unit_price_amount >= 0 AND refund_amount >= 0
);
ALTER TABLE "exchange_items" ADD CONSTRAINT "exchange_items_amounts_check" CHECK (
  quantity > 0 AND unit_price_amount >= 0 AND line_total_amount = unit_price_amount * quantity
);
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_amount_check" CHECK (amount > 0);
