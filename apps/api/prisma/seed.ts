import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type PermissionDef = { resource: string; action: string; description: string };

const PERMISSIONS: PermissionDef[] = [
  { resource: 'students', action: 'read', description: 'View students' },
  { resource: 'students', action: 'create', description: 'Create students' },
  { resource: 'students', action: 'update', description: 'Update students' },
  { resource: 'students', action: 'archive', description: 'Archive students' },
  { resource: 'parents', action: 'read', description: 'View guardians' },
  { resource: 'parents', action: 'manage', description: 'Manage guardians' },
  { resource: 'instructors', action: 'read', description: 'View instructors' },
  { resource: 'instructors', action: 'manage', description: 'Manage instructors' },
  { resource: 'courses', action: 'read', description: 'View courses' },
  { resource: 'courses', action: 'manage', description: 'Manage courses' },
  { resource: 'groups', action: 'read', description: 'View groups' },
  { resource: 'groups', action: 'manage', description: 'Manage groups' },
  { resource: 'enrollments', action: 'read', description: 'View enrollments' },
  { resource: 'enrollments', action: 'manage', description: 'Manage enrollments' },
  { resource: 'attendance', action: 'read', description: 'View attendance' },
  { resource: 'attendance', action: 'manage', description: 'Manage attendance' },
  { resource: 'payments', action: 'read', description: 'View payments' },
  { resource: 'payments', action: 'create', description: 'Record payments' },
  { resource: 'payments', action: 'update', description: 'Update payments' },
  { resource: 'payments', action: 'void', description: 'Void payments' },
  { resource: 'invoices', action: 'read', description: 'View invoices' },
  { resource: 'invoices', action: 'create', description: 'Create invoices' },
  { resource: 'invoices', action: 'update', description: 'Update invoices' },
  { resource: 'invoices', action: 'cancel', description: 'Cancel invoices' },
  { resource: 'expenses', action: 'read', description: 'View expenses' },
  { resource: 'expenses', action: 'manage', description: 'Manage expenses' },
  { resource: 'compensation', action: 'read', description: 'View instructor compensation' },
  { resource: 'compensation', action: 'manage', description: 'Manage instructor compensation' },
  { resource: 'reports', action: 'general', description: 'View general reports' },
  { resource: 'reports', action: 'financial', description: 'View financial reports' },
  { resource: 'certificates', action: 'read', description: 'View certificates' },
  { resource: 'certificates', action: 'manage', description: 'Manage certificates' },
  { resource: 'users', action: 'read', description: 'View users' },
  { resource: 'users', action: 'manage', description: 'Manage users' },
  { resource: 'roles', action: 'manage', description: 'Manage roles and permissions' },
  { resource: 'audit', action: 'read', description: 'View audit logs' },
  { resource: 'settings', action: 'manage', description: 'Manage system settings' },
  { resource: 'contracts', action: 'read', description: 'View employment contracts' },
  { resource: 'contracts', action: 'manage', description: 'Manage employment contracts' },
];

function key(resource: string, action: string) {
  return `${resource}.${action}`;
}

const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => key(p.resource, p.action));

const ADMIN_PERMISSIONS = [
  'students.read',
  'students.create',
  'students.update',
  'students.archive',
  'parents.read',
  'parents.manage',
  'instructors.read',
  'instructors.manage',
  'courses.read',
  'courses.manage',
  'groups.read',
  'groups.manage',
  'enrollments.read',
  'enrollments.manage',
  'attendance.read',
  'attendance.manage',
  'invoices.read',
  'invoices.create',
  'invoices.update',
  'invoices.cancel',
  'payments.read',
  'payments.create',
  'payments.update',
  'payments.void',
  'expenses.read',
  'expenses.manage',
  'reports.general',
  'reports.financial',
  'certificates.read',
  'certificates.manage',
  'compensation.read',
  'compensation.manage',
  'audit.read',
  'users.read',
  'users.manage',
  'settings.manage',
];

const INSTRUCTOR_PERMISSIONS = [
  'groups.read',
  'courses.read',
  'enrollments.read',
  'students.read',
  'attendance.read',
  'attendance.manage',
];

const ROLES = [
  {
    name: 'SUPER_ADMIN',
    displayName: 'Super Admin',
    description: 'Full platform access.',
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    name: 'ADMIN',
    displayName: 'Admin',
    description: 'Operational administration for Unity Tech Hub.',
    permissions: ADMIN_PERMISSIONS,
  },
  {
    name: 'INSTRUCTOR',
    displayName: 'Instructor',
    description: 'Restricted teaching access.',
    permissions: INSTRUCTOR_PERMISSIONS,
  },
] as const;

async function main() {
  console.log('Seeding permissions...');

  const permissionRecords = await Promise.all(
    PERMISSIONS.map((permission) =>
      prisma.permission.upsert({
        where: {
          resource_action: {
            resource: permission.resource,
            action: permission.action,
          },
        },
        update: { description: permission.description },
        create: permission,
      }),
    ),
  );

  const permissionByKey = new Map(
    permissionRecords.map((permission) => [key(permission.resource, permission.action), permission]),
  );

  console.log('Seeding roles...');

  for (const role of ROLES) {
    const createdRole = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        displayName: role.displayName,
        description: role.description,
      },
      create: {
        name: role.name,
        displayName: role.displayName,
        description: role.description,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: createdRole.id } });

    for (const permissionKey of role.permissions) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) {
        throw new Error(`Missing permission definition for ${permissionKey}`);
      }

      await prisma.rolePermission.create({
        data: {
          roleId: createdRole.id,
          permissionId: permission.id,
        },
      });
    }

    console.log(`  ✓ ${role.displayName}`);
  }

  console.log('Seeding demo users...');

  await upsertStaffUser({
    email: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@unitytechhub.com',
    password: process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'SuperAdmin123!',
    firstName: 'Super',
    lastName: 'Admin',
    roleName: 'SUPER_ADMIN',
  });

  await upsertStaffUser({
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@unitytechhub.com',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!',
    firstName: 'Ada',
    lastName: 'Admin',
    roleName: 'ADMIN',
  });

  const instructorUser = await upsertStaffUser({
    email: process.env.SEED_INSTRUCTOR_EMAIL ?? 'instructor@unitytechhub.com',
    password: process.env.SEED_INSTRUCTOR_PASSWORD ?? 'Instructor123!',
    firstName: 'Ivan',
    lastName: 'Instructor',
    roleName: 'INSTRUCTOR',
  });

  await prisma.instructor.upsert({
    where: { email: instructorUser.email },
    update: {
      userId: instructorUser.id,
      firstName: instructorUser.firstName,
      lastName: instructorUser.lastName,
      deletedAt: null,
    },
    create: {
      userId: instructorUser.id,
      firstName: instructorUser.firstName,
      lastName: instructorUser.lastName,
      email: instructorUser.email,
    },
  });

  console.log(`  ✓ Instructor profile (${instructorUser.email})`);
  console.log('Seed completed.');
}

async function upsertStaffUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleName: 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR';
}) {
  const email = input.email.trim().toLowerCase();
  const role = await prisma.role.findUniqueOrThrow({ where: { name: input.roleName } });
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id,
    },
  });

  console.log(`  ✓ ${input.roleName} user (${email})`);
  return user;
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
