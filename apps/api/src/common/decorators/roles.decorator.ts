import { SetMetadata } from '@nestjs/common';
import type { SystemRole } from '@unity/types';
import { ROLES_KEY } from '../constants/auth.constants';

export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);
