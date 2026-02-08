const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const handle = async (response) => {
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.error === "string" ? payload.error : "Request failed";
        throw new Error(message);
    }
    return response.json();
};
const request = (path, options = {}) => {
    const headers = options.body instanceof FormData
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
        return handle(await request(`/categories`));
    },
    async createCategory(name) {
        return handle(await request(`/categories`, {
            method: "POST",
            body: JSON.stringify({ name })
        }));
    },
    async createCategoryWithRecurring(name, recurring) {
        return handle(await request(`/categories`, {
            method: "POST",
            body: JSON.stringify({ name, recurring })
        }));
    },
    async updateCategory(id, payload) {
        return handle(await request(`/categories/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        }));
    },
    async deleteCategory(id) {
        const response = await request(`/categories/${id}`, { method: "DELETE" });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const message = typeof payload?.error === "string" ? payload.error : "Request failed";
            throw new Error(message);
        }
    },
    async getBudgets(month) {
        return handle(await request(`/budgets?month=${encodeURIComponent(month)}`));
    },
    async setBudget(categoryId, month, amount, targetAmount) {
        return handle(await request(`/budgets`, {
            method: "POST",
            body: JSON.stringify({ categoryId, month, amount, targetAmount })
        }));
    },
    async getSpends(month) {
        return handle(await request(`/spends?month=${encodeURIComponent(month)}`));
    },
    async createSpend(payload) {
        return handle(await request(`/spends`, {
            method: "POST",
            body: JSON.stringify(payload)
        }));
    },
    async deleteSpend(id) {
        const response = await request(`/spends/${id}`, { method: "DELETE" });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const message = typeof payload?.error === "string" ? payload.error : "Request failed";
            throw new Error(message);
        }
    },
    async getAccounts() {
        return handle(await request(`/accounts`));
    },
    async createAccount(payload) {
        return handle(await request(`/accounts`, {
            method: "POST",
            body: JSON.stringify(payload)
        }));
    },
    async updateAccount(id, payload) {
        return handle(await request(`/accounts/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        }));
    },
    async deleteAccount(id) {
        const response = await request(`/accounts/${id}`, { method: "DELETE" });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const message = typeof payload?.error === "string" ? payload.error : "Request failed";
            throw new Error(message);
        }
    },
    async getAccountBalances(id) {
        return handle(await request(`/accounts/${id}/balances`));
    },
    async getNetWorthReport(params) {
        const query = new URLSearchParams(params).toString();
        return handle(await request(`/reports/net-worth?${query}`));
    },
    async getSpendingReport(params) {
        const query = new URLSearchParams(params).toString();
        return handle(await request(`/reports/spending?${query}`));
    },
    async getCashflowReport(params) {
        const query = new URLSearchParams(params).toString();
        return handle(await request(`/reports/cashflow?${query}`));
    },
    async getIncome(month) {
        return handle(await request(`/income?month=${encodeURIComponent(month)}`));
    },
    async createIncome(payload) {
        return handle(await request(`/income`, {
            method: "POST",
            body: JSON.stringify(payload)
        }));
    },
    async deleteIncome(id) {
        const response = await request(`/income/${id}`, { method: "DELETE" });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const message = typeof payload?.error === "string" ? payload.error : "Request failed";
            throw new Error(message);
        }
    },
    async getPayeeRules() {
        return handle(await request(`/payee-rules`));
    },
    async createPayeeRule(payload) {
        return handle(await request(`/payee-rules`, {
            method: "POST",
            body: JSON.stringify(payload)
        }));
    },
    async deletePayeeRule(id) {
        const response = await request(`/payee-rules/${id}`, { method: "DELETE" });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const message = typeof payload?.error === "string" ? payload.error : "Request failed";
            throw new Error(message);
        }
    },
    async getPayeeRenames() {
        return handle(await request(`/payee-renames`));
    },
    async createPayeeRename(payload) {
        return handle(await request(`/payee-renames`, {
            method: "POST",
            body: JSON.stringify(payload)
        }));
    },
    async deletePayeeRename(id) {
        const response = await request(`/payee-renames/${id}`, { method: "DELETE" });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const message = typeof payload?.error === "string" ? payload.error : "Request failed";
            throw new Error(message);
        }
    },
    async setup(payload) {
        return handle(await request(`/auth/setup`, {
            method: "POST",
            body: JSON.stringify(payload)
        }));
    },
    async login(payload) {
        return handle(await request(`/auth/login`, {
            method: "POST",
            body: JSON.stringify(payload)
        }));
    },
    async logout() {
        return handle(await request(`/auth/logout`, {
            method: "POST"
        }));
    },
    async me() {
        return handle(await request(`/auth/me`));
    },
    async authStatus() {
        return handle(await request(`/auth/status`));
    },
    async setupTwoFactor() {
        return handle(await request(`/auth/2fa/setup`, { method: "POST" }));
    },
    async verifyTwoFactor(otp) {
        return handle(await request(`/auth/2fa/verify`, {
            method: "POST",
            body: JSON.stringify({ otp })
        }));
    },
    async disableTwoFactor(otp) {
        return handle(await request(`/auth/2fa/disable`, {
            method: "POST",
            body: JSON.stringify({ otp })
        }));
    }
};
//# sourceMappingURL=api.js.map