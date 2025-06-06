export interface Person {
  id: number;
  name: string;
  totalAmount: number;
  listOfAmounts: Amount[];
  splitwiseMember?: SplitwiseMember;
  splitwiseUserId?: number;
  isNonGroupMember?: boolean; // Flag to identify non-group members
}

export interface Amount {
  id: number;
  amount: number | undefined;
}

export interface SplitwiseMember {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  user_id?: number;
}

export interface SplitwiseGroup {
  id: number;
  name: string;
  members?: SplitwiseMember[];
}

export interface ApiResponse {
  groups?: SplitwiseGroup[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface ExpenseResponse {
  expenses: any[];
  errors: any;
}
