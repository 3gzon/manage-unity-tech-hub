# Database Architecture

Domain schema for the Unity Tech Hub Management Platform.

## Design principles

- **UUID** primary keys on all entities
- **`createdAt` / `updatedAt`** on mutable business records
- **`deletedAt`** soft delete on critical entities (users, students, parents, instructors, courses, groups, enrollments, invoices, payments, expenses, discounts)
- **`Decimal(12, 2)`** for all monetary fields
- **Normalized** relational model with junction tables for many-to-many links
- **Partial unique index** on enrollments prevents duplicate **ACTIVE** enrollment per student/group

## Entity groups

### Auth & RBAC

| Model | Purpose |
| --- | --- |
| `User` | Login account; optional link to Student/Parent/Instructor profile |
| `Role` | Named role (`SUPER_ADMIN`, `ADMIN`, `INSTRUCTOR`, …) |
| `Permission` | Resource + action pair (e.g. `students:manage`) |
| `UserRole` | User ↔ Role |
| `RolePermission` | Role ↔ Permission |

### People

| Model | Purpose |
| --- | --- |
| `Student` | Learner profile; future portal via optional `userId` |
| `Parent` | Guardian profile; many students via `StudentParent` |
| `StudentParent` | Student ↔ Parent with relationship type |
| `Instructor` | Teacher profile; teaches groups |

### Academics

| Model | Purpose |
| --- | --- |
| `Course` | Catalog item (code, name, status) |
| `Group` | Class instance of a course with schedule + primary instructor |
| `Enrollment` | Student placed in a group with pricing/discount |
| `ClassSession` | Single lesson occurrence |
| `Attendance` | Student presence for one session |

### Finance

| Model | Purpose |
| --- | --- |
| `Discount` | Reusable discount definition |
| `Invoice` / `InvoiceItem` | Billing documents |
| `Payment` | Money received; optionally linked to invoice |
| `InstructorCompensation` | Pay calculation per instructor/group/period |
| `Expense` | Operational costs |

### Other

| Model | Purpose |
| --- | --- |
| `Certificate` | Course completion credential |
| `Notification` | In-app user notifications |
| `AuditLog` | Immutable change history |

## Key relationships

```
Course 1──* Group *──1 Instructor (primary)
Group 1──* Enrollment *──1 Student
Student *──* Parent (via StudentParent)
Group 1──* ClassSession 1──* Attendance *──1 Student
Student 1──* Invoice 1──* InvoiceItem
Student 1──* Payment ──? Invoice
Enrollment ──? Discount
Instructor 1──* InstructorCompensation *──1 Group
User 1──* UserRole *──1 Role *──* Permission
```

## Commands

```bash
pnpm db:migrate    # apply migrations
pnpm db:seed       # seed roles & permissions
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma studio
```

## Seeded roles

- **SUPER_ADMIN** — all permissions
- **ADMIN** — operational + finance management
- **INSTRUCTOR** — read students, manage attendance

Finance, Student, and Parent roles are reserved for later prompts.
