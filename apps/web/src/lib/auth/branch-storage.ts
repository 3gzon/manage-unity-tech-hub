const BRANCH_KEY = 'uth_branch_id';

export function getStoredBranchId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(BRANCH_KEY);
}

export function setStoredBranchId(branchId: string) {
  localStorage.setItem(BRANCH_KEY, branchId);
}

export function clearStoredBranchId() {
  localStorage.removeItem(BRANCH_KEY);
}
