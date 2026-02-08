import { defineStore } from "pinia";
import { api, type Category, type CashflowTrendPoint, type Income, type MonthlyBudget, type Spend } from "../lib/api";

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export const useBudgetStore = defineStore("budget", {
  state: () => ({
    month: currentMonth(),
    categories: [] as Category[],
    budgets: [] as MonthlyBudget[],
    spends: [] as Spend[],
    incomes: [] as Income[],
    rollingCashflow: 0,
    isLoading: false,
    error: "" as string | null
  }),
  getters: {
    totalBudget: (state) =>
      state.budgets.reduce((sum, item) => sum + (item.effectiveAmount ?? item.amount), 0),
    totalIncome: (state) => state.incomes.reduce((sum, item) => sum + item.amount, 0),
    spendsForMonth: (state) => {
      const [year, month] = state.month.split("-").map(Number);
      if (!year || !month) return state.spends;
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      return state.spends.filter((spend) => {
        const spentAt = new Date(spend.spentAt);
        return spentAt >= start && spentAt < end;
      });
    },
    totalSpent: (state) => {
      const [year, month] = state.month.split("-").map(Number);
      if (!year || !month) return state.spends.reduce((sum, item) => sum + item.amount, 0);
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      return state.spends.reduce((sum, spend) => {
        const spentAt = new Date(spend.spentAt);
        return spentAt >= start && spentAt < end ? sum + spend.amount : sum;
      }, 0);
    },
    cashflow: (state) => {
      const totalIncome = state.incomes.reduce((sum, item) => sum + item.amount, 0);
      const [year, month] = state.month.split("-").map(Number);
      if (!year || !month) {
        const totalSpent = state.spends.reduce((sum, item) => sum + item.amount, 0);
        return totalIncome - totalSpent;
      }
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      const totalSpent = state.spends.reduce((sum, spend) => {
        const spentAt = new Date(spend.spentAt);
        return spentAt >= start && spentAt < end ? sum + spend.amount : sum;
      }, 0);
      return totalIncome - totalSpent;
    },
    rollingCashflowTotal: (state) => state.rollingCashflow,
    budgetByCategory: (state) => new Map(state.budgets.map((budget) => [budget.categoryId, budget]))
  },
  actions: {
    async fetchAll() {
      this.isLoading = true;
      this.error = null;
      try {
        const [categories, budgets, spends, incomes, rollingCashflow] = await Promise.all([
          api.getCategories(),
          api.getBudgets(this.month),
          api.getSpends(this.month),
          api.getIncome(this.month),
          this.fetchRollingCashflow()
        ]);
        this.categories = categories;
        this.budgets = budgets;
        this.spends = spends;
        this.incomes = incomes;
        if (typeof rollingCashflow === "number") {
          this.rollingCashflow = rollingCashflow;
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Unable to load budget data";
      } finally {
        this.isLoading = false;
      }
    },
    async fetchBudgets() {
      this.isLoading = true;
      this.error = null;
      try {
        this.budgets = await api.getBudgets(this.month);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Unable to load budgets";
      } finally {
        this.isLoading = false;
      }
    },
    async fetchSpends() {
      this.isLoading = true;
      this.error = null;
      try {
        this.spends = await api.getSpends(this.month);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Unable to load spends";
      } finally {
        this.isLoading = false;
      }
    },
    async fetchIncome() {
      this.isLoading = true;
      this.error = null;
      try {
        this.incomes = await api.getIncome(this.month);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Unable to load income";
      } finally {
        this.isLoading = false;
      }
    },
    async fetchRollingCashflow() {
      const [year, month] = this.month.split("-").map(Number);
      if (!year || !month) return 0;
      const start = new Date(Date.UTC(year, month - 12, 1));
      const end = new Date(Date.UTC(year, month - 1, 1));
      const formatMonth = (date: Date) =>
        `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const report = await api.getCashflowReport({
        from: formatMonth(start),
        to: formatMonth(end)
      });
      const latest = report.trend[report.trend.length - 1] as CashflowTrendPoint | undefined;
      this.rollingCashflow = latest ? latest.rolling : 0;
      return this.rollingCashflow;
    },
    async setMonth(value: string) {
      this.month = value;
      await Promise.all([
        this.fetchBudgets(),
        this.fetchSpends(),
        this.fetchIncome(),
        this.fetchRollingCashflow()
      ]);
    },
    async createCategory(name: string) {
      const category = await api.createCategory(name);
      this.categories.unshift(category);
      return category;
    },
    async createCategoryWithRecurring(name: string, recurring: boolean) {
      const category = await api.createCategoryWithRecurring(name, recurring);
      this.categories.unshift(category);
      return category;
    },
    async deleteCategory(id: string) {
      await api.deleteCategory(id);
      this.categories = this.categories.filter((category) => category.id !== id);
      this.budgets = this.budgets.filter((budget) => budget.categoryId !== id);
    },
    async setCategoryBudget(categoryId: string, amount: number) {
      const budget = await api.setBudget(categoryId, this.month, amount);
      const index = this.budgets.findIndex((item) => item.id === budget.id);
      if (index >= 0) {
        this.budgets.splice(index, 1, budget);
      } else {
        const fallbackIndex = this.budgets.findIndex((item) => item.categoryId === budget.categoryId);
        if (fallbackIndex >= 0) {
          this.budgets.splice(fallbackIndex, 1, budget);
        } else {
          this.budgets.push(budget);
        }
      }
    },
    async setCategoryTarget(categoryId: string, targetAmount: number | null) {
      const budget = await api.setBudget(categoryId, this.month, undefined, targetAmount);
      const index = this.budgets.findIndex((item) => item.id === budget.id);
      if (index >= 0) {
        this.budgets.splice(index, 1, budget);
      } else {
        const fallbackIndex = this.budgets.findIndex((item) => item.categoryId === budget.categoryId);
        if (fallbackIndex >= 0) {
          this.budgets.splice(fallbackIndex, 1, budget);
        } else {
          this.budgets.push(budget);
        }
      }
    },
    async createSpend(payload: {
      categoryId?: string;
      amount: number;
      spentAt: string;
      notes?: string;
      recurring?: boolean;
      payeeName?: string;
    }) {
      const spend = await api.createSpend(payload);
      this.spends.unshift(spend);
    },
    async deleteSpend(id: string) {
      await api.deleteSpend(id);
      this.spends = this.spends.filter((item) => item.id !== id);
    },
    async createIncome(payload: { amount: number; receivedAt: string; notes?: string }) {
      const income = await api.createIncome(payload);
      this.incomes.unshift(income);
    },
    async deleteIncome(id: string) {
      await api.deleteIncome(id);
      this.incomes = this.incomes.filter((item) => item.id !== id);
    }
  }
});
