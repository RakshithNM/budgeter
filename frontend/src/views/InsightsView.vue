<template>
  <section class="insights">
    <div class="insights__panel insights__panel--category">
      <div class="panel-header">
        <h2>Spending by category</h2>
        <span class="muted">{{ reportMonthLabel }}</span>
      </div>
      <div v-if="isLoading" class="muted">Loading reports…</div>
      <div v-else-if="byCategory.length === 0" class="muted">No spends for this month yet.</div>
      <div v-else class="chart-grid">
        <canvas ref="categoryChartEl" height="220" v-show="!isLoading"></canvas>
        <div class="legend">
          <div v-for="item in byCategory" :key="item.categoryId" class="legend-row">
            <span>{{ item.categoryName }}</span>
            <strong>
              {{ formatCurrency(item.total) }}
              <span class="muted">({{ percentOfTotal(item.total) }}%)</span>
            </strong>
          </div>
        </div>
      </div>
    </div>

    <div class="insights__panel insights__panel--trend">
      <div class="panel-header">
        <h2>Spending trend</h2>
        <span class="muted">Last {{ trend.length }} months</span>
      </div>
      <canvas ref="trendChartEl" height="240"></canvas>
    </div>

    <div class="insights__panel insights__panel--cashflow">
      <div class="panel-header">
        <h2>Income vs Spend</h2>
        <span class="muted">Last {{ cashflowTrend.length }} months</span>
      </div>
      <canvas ref="cashflowChartEl" height="240"></canvas>
    </div>

    <div class="insights__panel insights__panel--budget">
      <div class="panel-header">
        <h2>Budget vs Spend</h2>
        <span class="muted">{{ reportMonthLabel }}</span>
      </div>
      <canvas ref="budgetChartEl" height="240"></canvas>
    </div>

    <div class="insights__panel insights__panel--accent insights__panel--networth">
      <div class="panel-header">
        <h2>Net worth</h2>
        <span class="muted">{{ formatCurrency(netWorth) }}</span>
      </div>
      <div class="networth-grid">
        <canvas ref="netWorthChartEl" height="200"></canvas>
        <div class="networth-list">
          <div class="networth-row">
            <span>Assets</span>
            <strong>{{ formatCurrency(assetTotal) }}</strong>
          </div>
          <div class="networth-row">
            <span>Liabilities</span>
            <strong>{{ formatCurrency(liabilityTotal) }}</strong>
          </div>
          <div class="networth-row networth-row--total">
            <span>Total</span>
            <strong>{{ formatCurrency(netWorth) }}</strong>
          </div>
        </div>
      </div>

      <form class="account-form" @submit.prevent="handleAddAccount">
        <input v-model="accountForm.name" type="text" placeholder="Account name" required />
        <select v-model="accountForm.type" required>
          <option value="ASSET">Asset</option>
          <option value="LIABILITY">Liability</option>
        </select>
        <input
          :value="accountBalanceInput"
          inputmode="numeric"
          placeholder="Balance"
          @input="onAccountBalanceInput"
          @blur="onAccountBalanceBlur"
          required
        />
        <button type="submit">Add account</button>
      </form>

      <div class="account-list">
        <div v-for="account in accounts" :key="account.id" class="account-row">
          <div v-if="editingAccountId !== account.id">
            <strong>{{ account.name }}</strong>
            <span class="muted">· {{ account.type === 'ASSET' ? 'Asset' : 'Liability' }}</span>
          </div>
          <div v-else class="account-edit">
            <input v-model="editForm.name" type="text" />
            <select v-model="editForm.type">
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
            </select>
          </div>
          <div class="account-row__right">
            <span v-if="editingAccountId !== account.id">{{ formatCurrency(account.balance) }}</span>
            <input
              v-else
              :value="editBalanceInput"
              inputmode="numeric"
              @input="onEditBalanceInput"
              @blur="onEditBalanceBlur"
            />
            <button
              v-if="editingAccountId !== account.id"
              class="ghost"
              type="button"
              @click="startEditAccount(account)"
            >
              Edit
            </button>
            <button
              v-if="editingAccountId !== account.id"
              class="ghost"
              type="button"
              @click="removeAccount(account.id)"
            >
              Delete
            </button>
            <template v-else>
              <button class="ghost" type="button" @click="saveAccount(account.id)">Save</button>
              <button class="ghost" type="button" @click="cancelEdit">Cancel</button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="insights__panel insights__panel--networth-trend">
      <div class="panel-header">
        <h2>Net Worth Trend</h2>
        <span class="muted">Last {{ netWorthTrend.length }} months</span>
      </div>
      <canvas ref="netWorthTrendChartEl" height="240"></canvas>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Chart } from "chart.js/auto";
import {
  api,
  type Account,
  type CashflowTrendPoint,
  type NetWorthTrendPoint,
  type SpendingByCategory,
  type SpendingTrendPoint
} from "../lib/api";
import { useBudgetStore } from "../store";

const budget = useBudgetStore();
const isLoading = ref(false);
const byCategory = ref<SpendingByCategory[]>([]);
const trend = ref<SpendingTrendPoint[]>([]);
const cashflowTrend = ref<CashflowTrendPoint[]>([]);
const netWorthTrend = ref<NetWorthTrendPoint[]>([]);
const accounts = ref<Account[]>([]);

const categoryChartEl = ref<HTMLCanvasElement | null>(null);
const trendChartEl = ref<HTMLCanvasElement | null>(null);
const netWorthChartEl = ref<HTMLCanvasElement | null>(null);
const budgetChartEl = ref<HTMLCanvasElement | null>(null);
const cashflowChartEl = ref<HTMLCanvasElement | null>(null);
const netWorthTrendChartEl = ref<HTMLCanvasElement | null>(null);

let categoryChart: Chart | null = null;
let trendChart: Chart | null = null;
let netWorthChart: Chart | null = null;
let budgetChart: Chart | null = null;
let cashflowChart: Chart | null = null;
let netWorthTrendChart: Chart | null = null;

const accountForm = ref({
  name: "",
  type: "ASSET" as "ASSET" | "LIABILITY"
});
const accountBalanceInput = ref("");
const accountBalanceValue = ref<number | null>(null);
const editingAccountId = ref<string | null>(null);
const editForm = ref({
  name: "",
  type: "ASSET" as "ASSET" | "LIABILITY"
});
const editBalanceInput = ref("");
const editBalanceValue = ref<number | null>(null);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);

const parseNumber = (value: string) => {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits);
};

const reportMonthLabel = computed(() => {
  const [year, month] = budget.month.split("-").map(Number);
  if (!year || !month) return budget.month;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
});

const totalSpend = computed(() => byCategory.value.reduce((sum, item) => sum + item.total, 0));

const percentOfTotal = (value: number) => {
  if (!totalSpend.value) return 0;
  return Math.round((value / totalSpend.value) * 100);
};

const assetTotal = computed(() =>
  accounts.value
    .filter((account) => account.type === "ASSET")
    .reduce((sum, account) => sum + account.balance, 0)
);
const liabilityTotal = computed(() =>
  accounts.value
    .filter((account) => account.type === "LIABILITY")
    .reduce((sum, account) => sum + account.balance, 0)
);
const netWorth = computed(() => assetTotal.value - liabilityTotal.value);

const buildCategoryChart = () => {
  if (!categoryChartEl.value) return;
  const labels = byCategory.value.map((item) => item.categoryName);
  const data = byCategory.value.map((item) => item.total);
  if (categoryChart) {
    categoryChart.destroy();
    categoryChart = null;
  }
  if (!categoryChart) {
    categoryChart = new Chart(categoryChartEl.value, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: [
              "#1d4ed8",
              "#0f766e",
              "#a21caf",
              "#d97706",
              "#16a34a",
              "#e11d48",
              "#64748b"
            ]
          }
        ]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label ?? "";
                const value = typeof context.parsed === "number" ? context.parsed : 0;
                return `${label}: ${formatCurrency(value)}`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 900
        }
      }
    });
  } else {
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = data;
    categoryChart.update();
  }
};

const buildTrendChart = () => {
  if (!trendChartEl.value) return;
  const labels = trend.value.map((item) => {
    const [year, month] = item.month.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit"
    });
  });
  const data = trend.value.map((item) => item.total);
  if (!trendChart) {
    trendChart = new Chart(trendChartEl.value, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Total spend",
            data,
            borderColor: "#0f172a",
            backgroundColor: "rgba(15, 23, 42, 0.08)",
            fill: true,
            tension: 0.35
          }
        ]
      },
      options: {
        plugins: {
          legend: { display: false }
        }
      }
    });
  } else {
    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = data;
    trendChart.update();
  }
};

const buildCashflowChart = () => {
  if (!cashflowChartEl.value) return;
  const labels = cashflowTrend.value.map((item) => {
    const [year, month] = item.month.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit"
    });
  });
  const incomeData = cashflowTrend.value.map((item) => item.income);
  const spendData = cashflowTrend.value.map((item) => item.spend);
  const rollingData = cashflowTrend.value.map((item) => item.rolling);
  if (!cashflowChart) {
    cashflowChart = new Chart(cashflowChartEl.value, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Income",
            data: incomeData,
            backgroundColor: "rgba(22, 163, 74, 0.7)"
          },
          {
            label: "Spend",
            data: spendData,
            backgroundColor: "rgba(239, 68, 68, 0.65)"
          },
          {
            type: "line",
            label: "Rolling cashflow",
            data: rollingData,
            borderColor: "#0f172a",
            backgroundColor: "rgba(15, 23, 42, 0.08)",
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" }
        }
      }
    });
  } else {
    cashflowChart.data.labels = labels;
    cashflowChart.data.datasets[0].data = incomeData;
    cashflowChart.data.datasets[1].data = spendData;
    if (cashflowChart.data.datasets[2]) {
      cashflowChart.data.datasets[2].data = rollingData;
    }
    cashflowChart.update();
  }
};

const buildBudgetChart = () => {
  if (!budgetChartEl.value) return;
  const budgetMap = new Map(budget.budgets.map((item) => [item.categoryId, item]));
  const categoryLabels = budget.categories.map((category) => category.name);
  const budgetData = budget.categories.map(
    (category) => budgetMap.get(category.id)?.effectiveAmount ?? budgetMap.get(category.id)?.amount ?? 0
  );
  const spendMap = new Map(byCategory.value.map((item) => [item.categoryId, item.total]));
  const spendData = budget.categories.map((category) => spendMap.get(category.id) ?? 0);

  if (!budgetChart) {
    budgetChart = new Chart(budgetChartEl.value, {
      type: "bar",
      data: {
        labels: categoryLabels,
        datasets: [
          {
            label: "Budget",
            data: budgetData,
            backgroundColor: "rgba(29, 78, 216, 0.7)"
          },
          {
            label: "Spend",
            data: spendData,
            backgroundColor: "rgba(239, 68, 68, 0.65)"
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" }
        }
      }
    });
  } else {
    budgetChart.data.labels = categoryLabels;
    budgetChart.data.datasets[0].data = budgetData;
    budgetChart.data.datasets[1].data = spendData;
    budgetChart.update();
  }
};

const buildNetWorthChart = () => {
  if (!netWorthChartEl.value) return;
  const data = [assetTotal.value, liabilityTotal.value];
  if (!netWorthChart) {
    netWorthChart = new Chart(netWorthChartEl.value, {
      type: "bar",
      data: {
        labels: ["Assets", "Liabilities"],
        datasets: [
          {
            data,
            backgroundColor: ["#16a34a", "#ef4444"]
          }
        ]
      },
      options: {
        plugins: {
          legend: { display: false }
        }
      }
    });
  } else {
    netWorthChart.data.datasets[0].data = data;
    netWorthChart.update();
  }
};

const buildNetWorthTrendChart = () => {
  if (!netWorthTrendChartEl.value) return;
  const labels = netWorthTrend.value.map((item) => {
    const [year, month] = item.month.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit"
    });
  });
  const data = netWorthTrend.value.map((item) => item.net);
  if (!netWorthTrendChart) {
    netWorthTrendChart = new Chart(netWorthTrendChartEl.value, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Net worth",
            data,
            borderColor: "#0f172a",
            backgroundColor: "rgba(15, 23, 42, 0.08)",
            fill: true,
            tension: 0.35
          }
        ]
      },
      options: {
        plugins: {
          legend: { display: false }
        }
      }
    });
  } else {
    netWorthTrendChart.data.labels = labels;
    netWorthTrendChart.data.datasets[0].data = data;
    netWorthTrendChart.update();
  }
};

const loadReports = async () => {
  isLoading.value = true;
  try {
    const [year, month] = budget.month.split("-").map(Number);
    const current = new Date(Date.UTC(year, month - 1, 1));
    const from = new Date(Date.UTC(year, month - 6 + 1, 1));
    const formatMonth = (date: Date) =>
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const [spending, cashflow] = await Promise.all([
      api.getSpendingReport({
        from: formatMonth(from),
        to: formatMonth(current),
        month: budget.month
      }),
      api.getCashflowReport({
        from: formatMonth(from),
        to: formatMonth(current)
      })
    ]);
    byCategory.value = spending.byCategory;
    trend.value = spending.trend;
    cashflowTrend.value = cashflow.trend;
    const netWorth = await api.getNetWorthReport({
      from: formatMonth(from),
      to: formatMonth(current)
    });
    netWorthTrend.value = netWorth.trend;
    await nextTick();
    setTimeout(buildCategoryChart, 0);
    buildTrendChart();
    buildCashflowChart();
    buildBudgetChart();
    buildNetWorthTrendChart();
  } finally {
    isLoading.value = false;
  }
};

const loadAccounts = async () => {
  accounts.value = await api.getAccounts();
  buildNetWorthChart();
};

const onAccountBalanceInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  accountBalanceInput.value = target.value;
  accountBalanceValue.value = parseNumber(target.value);
};

const onAccountBalanceBlur = () => {
  accountBalanceInput.value =
    accountBalanceValue.value == null ? "" : formatNumber(accountBalanceValue.value);
};

const handleAddAccount = async () => {
  if (!accountForm.value.name.trim()) return;
  if (accountBalanceValue.value == null || Number.isNaN(accountBalanceValue.value)) return;
  const created = await api.createAccount({
    name: accountForm.value.name.trim(),
    type: accountForm.value.type,
    balance: Math.round(accountBalanceValue.value)
  });
  accounts.value.unshift(created);
  accountForm.value.name = "";
  accountBalanceInput.value = "";
  accountBalanceValue.value = null;
  buildNetWorthChart();
};

const removeAccount = async (id: string) => {
  await api.deleteAccount(id);
  accounts.value = accounts.value.filter((account) => account.id !== id);
  buildNetWorthChart();
};

const startEditAccount = (account: Account) => {
  editingAccountId.value = account.id;
  editForm.value = { name: account.name, type: account.type };
  editBalanceValue.value = account.balance;
  editBalanceInput.value = formatNumber(account.balance);
};

const onEditBalanceInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  editBalanceInput.value = target.value;
  editBalanceValue.value = parseNumber(target.value);
};

const onEditBalanceBlur = () => {
  editBalanceInput.value =
    editBalanceValue.value == null ? "" : formatNumber(editBalanceValue.value);
};

const cancelEdit = () => {
  editingAccountId.value = null;
  editBalanceInput.value = "";
  editBalanceValue.value = null;
};

const saveAccount = async (id: string) => {
  if (!editForm.value.name.trim()) return;
  if (editBalanceValue.value == null || Number.isNaN(editBalanceValue.value)) return;
  const updated = await api.updateAccount(id, {
    name: editForm.value.name.trim(),
    type: editForm.value.type,
    balance: Math.round(editBalanceValue.value)
  });
  const index = accounts.value.findIndex((account) => account.id === id);
  if (index >= 0) {
    accounts.value.splice(index, 1, updated);
  }
  cancelEdit();
  buildNetWorthChart();
};

watch(
  () => budget.month,
  async () => {
    await loadReports();
    buildBudgetChart();
  }
);

watch([assetTotal, liabilityTotal], () => {
  buildNetWorthChart();
});

onMounted(async () => {
  if (budget.categories.length === 0) {
    await budget.fetchAll();
  }
  await Promise.all([loadReports(), loadAccounts()]);
  buildBudgetChart();
});

onBeforeUnmount(() => {
  categoryChart?.destroy();
  trendChart?.destroy();
  netWorthChart?.destroy();
  budgetChart?.destroy();
  cashflowChart?.destroy();
  netWorthTrendChart?.destroy();
});

watch(
  () => [budget.budgets, budget.categories],
  () => {
    buildBudgetChart();
  },
  { deep: true }
);
</script>

<style scoped lang="scss">
.insights {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.insights__panel {
  background: var(--surface);
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: var(--shadow-soft);
}

.insights__panel--accent {
  background: linear-gradient(150deg, rgba(130, 174, 255, 0.35), rgba(255, 255, 255, 0.85));
}

.insights__panel--category {
  background: linear-gradient(145deg, rgba(31, 122, 109, 0.18), rgba(255, 250, 242, 0.92));
}

.insights__panel--trend {
  background: linear-gradient(145deg, rgba(194, 75, 58, 0.16), rgba(255, 250, 242, 0.92));
}

.insights__panel--cashflow {
  background: linear-gradient(145deg, rgba(20, 90, 79, 0.18), rgba(255, 250, 242, 0.92));
}

.insights__panel--budget {
  background: linear-gradient(145deg, rgba(236, 196, 133, 0.3), rgba(255, 250, 242, 0.92));
}

.insights__panel--networth {
  background: linear-gradient(150deg, rgba(31, 122, 109, 0.22), rgba(255, 250, 242, 0.9));
}

.insights__panel--networth-trend {
  background: linear-gradient(145deg, rgba(95, 90, 82, 0.18), rgba(255, 250, 242, 0.92));
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.chart-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  align-items: center;
  margin-top: 1rem;
}


.legend {
  display: grid;
  gap: 0.6rem;
}

.legend-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.95rem;
}

.muted {
  color: var(--muted-text);
}

.networth-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 1rem;
  align-items: center;
}

.networth-list {
  display: grid;
  gap: 0.75rem;
}

.networth-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.95rem;
}

.networth-row--total {
  padding-top: 0.5rem;
  border-top: 1px solid rgba(15, 23, 42, 0.1);
  font-weight: 700;
}

.account-form {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.5rem;

  input,
  select {
    padding: 0.6rem 0.8rem;
    border-radius: 0.9rem;
    border: 1px solid rgba(15, 23, 42, 0.15);
    font: inherit;
  }

  button {
    border: none;
    border-radius: 999px;
    padding: 0.6rem 1rem;
    background: var(--accent);
    color: var(--surface);
    font-weight: 600;
    cursor: pointer;
    justify-self: start;
  }
}

.account-list {
  margin-top: 1.5rem;
  display: grid;
  gap: 0.75rem;
}

.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 1rem;
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.05);
}

.account-edit {
  display: grid;
  gap: 0.5rem;

  input,
  select {
    padding: 0.4rem 0.6rem;
    border-radius: 0.6rem;
    border: 1px solid rgba(15, 23, 42, 0.15);
    font: inherit;
  }
}

.account-row__right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;

  input {
    max-width: 140px;
    padding: 0.35rem 0.5rem;
    border-radius: 0.6rem;
    border: 1px solid rgba(15, 23, 42, 0.15);
    font: inherit;
  }
}

.ghost {
  border: none;
  background: transparent;
  color: var(--muted-text);
  cursor: pointer;
  font-size: 0.85rem;
}
</style>
