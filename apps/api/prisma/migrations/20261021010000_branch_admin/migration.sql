INSERT INTO roles (id, name, display_name, description, created_at, updated_at)
VALUES (
  'b1000000-0000-4000-8000-000000000003',
  'BRANCH_ADMIN',
  'Sub Super Admin',
  'Manages a single branch.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), branch_role.id, super_permissions.permission_id
FROM roles AS branch_role
JOIN roles AS super_role ON super_role.name = 'SUPER_ADMIN'
JOIN role_permissions AS super_permissions ON super_permissions.role_id = super_role.id
WHERE branch_role.name = 'BRANCH_ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;
