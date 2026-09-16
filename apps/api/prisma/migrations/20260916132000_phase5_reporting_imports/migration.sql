CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "product_imports" (
    "id" UUID NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL,
    "valid_rows" INTEGER NOT NULL,
    "error_rows" INTEGER NOT NULL,
    "rows_data" JSONB NOT NULL,
    "errors_data" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "product_imports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_imports_counts_check" CHECK ("total_rows" >= 0 AND "valid_rows" >= 0 AND "error_rows" >= 0 AND "valid_rows" + "error_rows" = "total_rows")
);

CREATE INDEX "product_imports_created_by_created_at_idx" ON "product_imports"("created_by", "created_at" DESC);
CREATE INDEX "product_imports_status_expires_at_idx" ON "product_imports"("status", "expires_at");

ALTER TABLE "product_imports"
ADD CONSTRAINT "product_imports_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
