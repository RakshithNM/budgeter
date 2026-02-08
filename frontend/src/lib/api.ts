const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export type Category = {
  id: string;
  name: string;
  recurring: boolean;
  createdAt: string;
};

export type MonthlyBudget = {
  id: string;
  month: string;
  amount: number;
  targetAmount: number | null;
  rolloverAmount?: number;
  effectiveAmount?: number;
  categoryId: string;
  category: Category;
  createdAt: string;
  updatedAt: string;
};

export type Spend = {
  id: string;
  amount: number;
  notes: string | null;
  recurring: boolean;
  payeeName: string | null;
  payeeDisplay?: string | null;
  spentAt: string;
  categoryId: string;
  category: Category;
  createdAt: string;
};

export type PayeeRule = {
  id: string;
  matchText: string;
  categoryId: string;
  category: Category;
  createdAt: string;
};

export type PayeeRename = {
  id: string;
  matchText: string;
  renameTo: string;
  createdAt: string;
};

export type Account = {
  id: string;
  name: string;
  type: "ASSET" | "LIABILITY";
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type AccountBalance = {
  id: string;
  accountId: string;
  balance: number;
  recordedAt: string;
};

export type NetWorthTrendPoint = {
  month: string;
  assets: number;
  liabilities: number;
  net: number;
};

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

export type AuthStatus = {
  setupComplete: boolean;
};

export type TwoFactorSetup = {
  otpauthUrl: string | null;
  qrCode: string;
  secret: string;
};

export type Income = {
  id: string;
  amount: number;
  notes: string | null;
  receivedAt: string;
  createdAt: string;
};

export type SpendingTrendPoint = {
  month: string;
  total: number;
};

export type SpendingByCategory = {
  categoryId: string;
  categoryName: string;
  total: number;
};

export type CashflowTrendPoint = {
  month: string;
  income: number;
  spend: number;
  net: number;
  rolling: number;
};

const handle = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload?.error === "string" ? payload.error : "Request failed";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

const request = (path: string, options: RequestInit = {}) => {
  const headers =
    options.body instanceof FormData
      ? options.headers
      : { "Content-Type": "application/json", ...options.headers };
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers
  });
};

export const api = {
  async getCategories() {
    return handle<Category[]>(await request(`/categories`));
  },
  async createCategory(name: string) {
    return handle<Category>(
      await request(`/categories`, {
        method: "POST",
        body: JSON.stringify({ name })
      })
    );
  },
  async createCategoryWithRecurring(name: string, recurring: boolean) {
    return handle<Category>(
      await request(`/categories`, {
        method: "POST",
        body: JSON.stringify({ name, recurring })
      })
    );
  },
  async updateCategory(id: string, payload: { recurring?: boolean }) {
    return handle<Category>(
      await request(`/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      })
    );
  },
  async deleteCategory(id: string) {
    const response = await request(`/categories/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : "Request failed";
      throw new Error(message);
    }
  },
  async getBudgets(month: string) {
    return handle<MonthlyBudget[]>(
      await request(`/budgets?month=${encodeURIComponent(month)}`)
    );
  },
  async setBudget(categoryId: string, month: string, amount?: number, targetAmount?: number | null) {
    return handle<MonthlyBudget>(
      await request(`/budgets`, {
        method: "POST",
        body: JSON.stringify({ categoryId, month, amount, targetAmount })
      })
    );
  },
  async getSpends(month: string) {
    return handle<Spend[]>(await request(`/spends?month=${encodeURIComponent(month)}`));
  },
  async createSpend(payload: {
    categoryId?: string;
    amount: number;
    spentAt: string;
    notes?: string;
    recurring?: boolean;
    payeeName?: string;
  }) {
    return handle<Spend>(
      await request(`/spends`, {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );
  },
  async deleteSpend(id: string) {
    const response = await request(`/spends/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : "Request failed";
      throw new Error(message);
    }
  },
  async getAccounts() {
    return handle<Account[]>(await request(`/accounts`));
  },
  async createAccount(payload: { name: string; type: "ASSET" | "LIABILITY"; balance: number }) {
    return handle<Account>(
      await request(`/accounts`, {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );
  },
  async updateAccount(id: string, payload: { name?: string; type?: "ASSET" | "LIABILITY"; balance?: number }) {
    return handle<Account>(
      await request(`/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      })
    );
  },
  async deleteAccount(id: string) {
    const response = await request(`/accounts/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : "Request failed";
      throw new Error(message);
    }
  },
  async getAccountBalances(id: string) {
    return handle<AccountBalance[]>(await request(`/accounts/${id}/balances`));
  },
  async getNetWorthReport(params: { from: string; to: string }) {
    const query = new URLSearchParams(params).toString();
    return handle<{ trend: NetWorthTrendPoint[] }>(
      await request(`/reports/net-worth?${query}`)
    );
  },
  async getSpendingReport(params: { from: string; to: string; month: string }) {
    const query = new URLSearchParams(params).toString();
    return handle<{ trend: SpendingTrendPoint[]; byCategory: SpendingByCategory[] }>(
      await request(`/reports/spending?${query}`)
    );
  },
  async getCashflowReport(params: { from: string; to: string }) {
    const query = new URLSearchParams(params).toString();
    return handle<{ trend: CashflowTrendPoint[] }>(
      await request(`/reports/cashflow?${query}`)
    );
  },
  async getIncome(month: string) {
    return handle<Income[]>(await request(`/income?month=${encodeURIComponent(month)}`));
  },
  async createIncome(payload: { amount: number; receivedAt: string; notes?: string }) {
    return handle<Income>(
      await request(`/income`, {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );
  },
  async deleteIncome(id: string) {
    const response = await request(`/income/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : "Request failed";
      throw new Error(message);
    }
  },
  async getPayeeRules() {
    return handle<PayeeRule[]>(await request(`/payee-rules`));
  },
  async createPayeeRule(payload: { matchText: string; categoryId: string }) {
    return handle<PayeeRule>(
      await request(`/payee-rules`, {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );
  },
  async deletePayeeRule(id: string) {
    const response = await request(`/payee-rules/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : "Request failed";
      throw new Error(message);
    }
  },
  async getPayeeRenames() {
    return handle<PayeeRename[]>(await request(`/payee-renames`));
  },
  async createPayeeRename(payload: { matchText: string; renameTo: string }) {
    return handle<PayeeRename>(
      await request(`/payee-renames`, {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );
  },
  async deletePayeeRename(id: string) {
    const response = await request(`/payee-renames/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload?.error === "string" ? payload.error : "Request failed";
      throw new Error(message);
    }
  },
  async setup(payload: { email: string; password: string; name?: string }) {
    return handle<AuthUser>(
      await request(`/auth/setup`, {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );
  },
  async login(payload: { email: string; password: string; otp?: string }) {
    return handle<AuthUser>(
      await request(`/auth/login`, {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );
  },
  async logout() {
    return handle<{ status: string }>(
      await request(`/auth/logout`, {
        method: "POST"
      })
    );
  },
  async me() {
    return handle<AuthUser>(await request(`/auth/me`));
  },
  async authStatus() {
    return handle<AuthStatus>(await request(`/auth/status`));
  },
  async setupTwoFactor() {
    return handle<TwoFactorSetup>(await request(`/auth/2fa/setup`, { method: "POST" }));
  },
  async verifyTwoFactor(otp: string) {
    return handle<{ status: string }>(
      await request(`/auth/2fa/verify`, {
        method: "POST",
        body: JSON.stringify({ otp })
      })
    );
  },
  async disableTwoFactor(otp: string) {
    return handle<{ status: string }>(
      await request(`/auth/2fa/disable`, {
        method: "POST",
        body: JSON.stringify({ otp })
      })
    );
  }
};
