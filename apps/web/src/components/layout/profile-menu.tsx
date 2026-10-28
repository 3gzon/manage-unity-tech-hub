'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth/auth-context';
import { ChevronDown, LogOut } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  BRANCH_ADMIN: 'Sub Super Admin',
  INSTRUCTOR: 'Instructor',
};

export function ProfileMenu() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  const role = ROLE_LABELS[user.roles[0] ?? ''] ?? 'Staff';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-border bg-muted px-2 py-1 transition hover:bg-card hover:shadow-sm"
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-[#03FE94] text-[11px] font-semibold text-[#020D23]">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[120px] truncate text-sm font-medium leading-tight text-foreground">
              {user.firstName} {user.lastName}
            </span>
            <span className="block text-[11px] leading-tight text-muted-foreground">{role}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
