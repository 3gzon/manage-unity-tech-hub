CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "school_name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "multi_course_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "family_pack_discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "invoice_due_day" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "system_settings" (
    "id",
    "school_name",
    "currency",
    "multi_course_discount_percent",
    "family_pack_discount_percent",
    "invoice_due_day",
    "updated_at"
) VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Unity Tech Hub',
    'EUR',
    10,
    10,
    10,
    CURRENT_TIMESTAMP
);

INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT gen_random_uuid(), roles."id", permissions."id", CURRENT_TIMESTAMP
FROM "roles"
JOIN "permissions" ON permissions."resource" = 'settings' AND permissions."action" = 'manage'
WHERE roles."name" = 'ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
