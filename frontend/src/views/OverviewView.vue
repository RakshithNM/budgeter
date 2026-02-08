<template>
  <section class="overview">
    <div class="overview__summary">
      <div class="summary-card summary-card--month">
        <p class="label">Selected Month</p>
        <div class="month-picker">
          <div class="month-picker__selects">
            <select v-model.number="selectedMonthValue">
              <option v-for="month in monthOptions" :key="month.value" :value="month.value">
                {{ month.label }}
              </option>
            </select>
            <select v-model.number="selectedYear">
              <option v-for="year in yearOptions" :key="year" :value="year">
                {{ year }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div class="summary-card summary-card--metrics">
        <div>
          <p class="label">Total Budgeted</p>
          <h2>{{ formatCurrency(budget.totalBudget) }}</h2>
        </div>
        <div>
          <p class="label">Income & Cashflow</p>
          <h2>{{ formatCurrency(budget.totalIncome) }}</h2>
          <p class="muted">
            Cashflow: <strong :class="budget.rollingCashflowTotal < 0 ? 'negative' : ''">
              {{ formatCurrency(budget.rollingCashflowTotal) }}
            </strong>
          </p>
          <p class="muted">
            This month: <strong :class="budget.cashflow < 0 ? 'negative' : ''">
              {{ formatCurrency(budget.cashflow) }}
            </strong>
          </p>
        </div>
      </div>
    </div>

    <div class="overview__grid">
      <div class="overview__card overview__card--search">
        <h3>Search</h3>
        <p class="muted">Search across spends and categories.</p>
        <input
          v-model="globalSearch"
          type="text"
          placeholder="Search payee, category, or notes"
          class="search-input"
        />
        <button v-if="globalSearch" class="ghost" type="button" @click="clearSearch">
          Clear
        </button>
      </div>

      <div class="overview__card">
        <h3>Add a spend</h3>
        <p class="muted">Log individual spends with optional notes.</p>

        <form class="spend-form" @submit.prevent="handleAddSpend">
          <select v-model="spendForm.categoryId">
            <option disabled value="">Select category</option>
            <option v-for="category in budget.categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <div class="spend-hint muted">Leave category empty to auto-assign from a payee rule.</div>
          <input v-model="spendForm.payeeName" type="text" placeholder="Payee (optional)" />
          <div class="spend-form__row">
            <input
              :value="spendAmountInput"
              inputmode="numeric"
              placeholder="Amount"
              @input="onSpendAmountInput"
              @blur="onSpendAmountBlur"
              required
            />
            <input v-model="spendForm.spentAt" type="date" required />
          </div>
          <label class="toggle">
            <input v-model="spendForm.recurring" type="checkbox" />
            Recurring
          </label>
          <input v-model="spendForm.notes" type="text" placeholder="Notes (optional)" />
          <button type="submit">Add Spend</button>
        </form>
        <div v-if="spendError" class="error">{{ spendError }}</div>

        <div class="spend-list">
          <div v-for="spend in filteredSpends" :key="spend.id" class="spend-row">
            <div>
              <strong>{{ spend.category.name }}</strong>
              <span v-if="spend.recurring" class="badge">Recurring</span>
              <div class="muted">
                {{ new Date(spend.spentAt).toLocaleDateString("en-IN") }}
                <span v-if="spend.payeeDisplay || spend.payeeName">
                  · {{ spend.payeeDisplay ?? spend.payeeName }}
                </span>
                <span v-if="spend.notes">· {{ spend.notes }}</span>
              </div>
            </div>
            <div class="spend-row__right">
              <span>{{ formatCurrency(spend.amount) }}</span>
              <button class="ghost" type="button" @click="removeSpend(spend.id)">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <div class="overview__card">
        <h3>Categories</h3>
        <p class="muted">
          Add user-defined categories and set a monthly budget for each one.
        </p>

        <form class="category-form" @submit.prevent="handleAddCategory">
          <input
            v-model="newCategory"
            type="text"
            placeholder="New category name"
            required
          />
          <input
            v-model="newCategoryAmountInput"
            inputmode="numeric"
            placeholder="Budget amount"
            @input="onNewCategoryAmountInput"
            @blur="onNewCategoryAmountBlur"
          />
          <div class="category-form__actions">
            <label class="toggle">
              <input v-model="newCategoryRecurring" type="checkbox" />
              Recurring
            </label>
            <button type="submit">Add</button>
          </div>
        </form>

        <div v-if="budget.error" class="error">{{ budget.error }}</div>
        <div v-if="budget.isLoading" class="muted">Loading…</div>

        <div v-if="budget.categories.length === 0 && !budget.isLoading" class="empty">
          No categories yet. Add one to start budgeting.
        </div>

        <div class="category-list">
          <div
            v-for="category in filteredCategories"
            :key="category.id"
            class="category-row"
          >
            <div class="category-row__info">
              <strong>{{ category.name }}</strong>
              <span v-if="category.recurring" class="badge">Recurring</span>
              <button class="ghost" type="button" @click="removeCategory(category.id)">
                Remove
              </button>
            </div>
            <div class="category-row__budget">
              <span class="currency">₹</span>
              <input
                :value="budgetInputs[category.id]"
                inputmode="numeric"
                placeholder="0"
                @input="onBudgetInput(category.id, $event)"
                @blur="onBudgetBlur(category.id)"
              />
              <button type="button" @click="saveBudget(category.id)">Save</button>
            </div>
            <div
              v-if="budgetByCategory.get(category.id)?.rolloverAmount !== 0"
              class="category-row__rollover"
            >
              Rollover: {{ formatCurrency(budgetByCategory.get(category.id)?.rolloverAmount ?? 0) }}
            </div>
            <div class="category-row__target">
              <span class="currency">₹</span>
              <input
                :value="targetInputs[category.id]"
                inputmode="numeric"
                placeholder="Target"
                @input="onTargetInput(category.id, $event)"
                @blur="onTargetBlur(category.id)"
              />
              <button type="button" @click="saveTarget(category.id)">Save Target</button>
            </div>
            <div class="category-row__progress" v-if="budgetByCategory.get(category.id)?.targetAmount">
              <div class="progress-meta">
                <span>
                  {{ formatCurrency(spentByCategory.get(category.id) ?? 0) }} /
                  {{ formatCurrency(budgetByCategory.get(category.id)?.targetAmount ?? 0) }}
                </span>
                <span>{{ progressPercent(category.id) }}%</span>
              </div>
              <div class="progress-bar">
                <span
                  class="progress-bar__fill"
                  :style="{ width: `${progressPercent(category.id)}%` }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="overview__card">
        <h3>Add income</h3>
        <p class="muted">Track income received this month.</p>

        <form class="spend-form" @submit.prevent="handleAddIncome">
          <div class="spend-form__row">
            <input
              :value="incomeAmountInput"
              inputmode="numeric"
              placeholder="Amount"
              @input="onIncomeAmountInput"
              @blur="onIncomeAmountBlur"
              required
            />
            <input v-model="incomeForm.receivedAt" type="date" required />
          </div>
          <input v-model="incomeForm.notes" type="text" placeholder="Notes (optional)" />
          <button type="submit">Add Income</button>
        </form>

        <div class="spend-list">
          <div v-for="income in budget.incomes" :key="income.id" class="spend-row">
            <div>
              <strong>Income</strong>
              <div class="muted">
                {{ new Date(income.receivedAt).toLocaleDateString("en-IN") }}
                <span v-if="income.notes">· {{ income.notes }}</span>
              </div>
            </div>
            <div class="spend-row__right">
              <span>{{ formatCurrency(income.amount) }}</span>
              <button class="ghost" type="button" @click="removeIncome(income.id)">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <div class="overview__card">
        <h3>Payees & Rules</h3>
        <p class="muted">Rename payees and auto-assign categories based on payee text.</p>

        <form class="rule-form" @submit.prevent="handleAddPayeeRename">
          <input v-model="payeeRenameForm.matchText" type="text" placeholder="Payee contains…" />
          <input v-model="payeeRenameForm.renameTo" type="text" placeholder="Rename to" />
          <button type="submit">Add rename</button>
        </form>

        <div class="rule-list">
          <div v-for="rename in payeeRenames" :key="rename.id" class="rule-row">
            <div>
              <strong>{{ rename.matchText }}</strong>
              <span class="muted">→ {{ rename.renameTo }}</span>
            </div>
            <button class="ghost" type="button" @click="removePayeeRename(rename.id)">Delete</button>
          </div>
        </div>

        <form class="rule-form" @submit.prevent="handleAddPayeeRule">
          <input v-model="payeeRuleForm.matchText" type="text" placeholder="Payee contains…" />
          <select v-model="payeeRuleForm.categoryId" required>
            <option disabled value="">Select category</option>
            <option v-for="category in budget.categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <button type="submit">Add rule</button>
        </form>

        <div class="rule-list">
          <div v-for="rule in payeeRules" :key="rule.id" class="rule-row">
            <div>
              <strong>{{ rule.matchText }}</strong>
              <span class="muted">→ {{ rule.category.name }}</span>
            </div>
            <button class="ghost" type="button" @click="removePayeeRule(rule.id)">Delete</button>
          </div>
        </div>
      </div>

      <div class="overview__card">
        <h3>Two-factor authentication</h3>
        <p class="muted">Protect your account with an authenticator app.</p>

        <div v-if="twoFactorStatus" class="muted">{{ twoFactorStatus }}</div>

        <div class="twofa__actions" v-if="!twoFactorSetup">
          <button class="btn" type="button" @click="startTwoFactor">Generate QR code</button>
          <button class="ghost" type="button" @click="toggleDisableTwoFactor">
            Disable 2FA
          </button>
        </div>

        <div v-if="twoFactorSetup" class="twofa">
          <img :src="twoFactorSetup.qrCode" alt="2FA QR code" />
          <div class="twofa__details">
            <p class="muted">Scan this with Google Authenticator.</p>
            <p class="mono">{{ twoFactorSetup.secret }}</p>
            <div class="twofa__verify">
              <input v-model="twoFactorOtp" type="text" inputmode="numeric" placeholder="Enter code" />
              <button class="btn" type="button" @click="verifyTwoFactor">Enable 2FA</button>
            </div>
            <div v-if="showDisableTwoFactor" class="twofa__disable">
              <input
                v-model="disableTwoFactorOtp"
                type="text"
                inputmode="numeric"
                placeholder="Enter code to disable"
              />
              <button class="ghost" type="button" @click="disableTwoFactor">Disable 2FA</button>
            </div>
          </div>
        </div>
      </div>

      <div class="overview__card overview__card--accent">
        <h3>Budget Snapshot</h3>
        <ul>
          <li>Review and adjust category budgets every month.</li>
          <li>Keep the total aligned with your expected income.</li>
          <li>Use insights to spot underspent or overspent areas.</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { api, type PayeeRename, type PayeeRule, type TwoFactorSetup } from "../lib/api";
import { useBudgetStore } from "../store";

const budget = useBudgetStore();
const newCategory = ref("");
const newCategoryRecurring = ref(false);
const newCategoryAmountInput = ref("");
const newCategoryAmountValue = ref<number | null>(null);
const selectedMonth = ref(budget.month);
const selectedYear = ref(Number(budget.month.split("-")[0]));
const selectedMonthValue = ref(Number(budget.month.split("-")[1]));
const budgetDrafts = reactive<Record<string, number | null>>({});
const budgetInputs = reactive<Record<string, string>>({});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);

const syncDrafts = () => {
  budget.categories.forEach((category) => {
    const existing = budget.budgets.find((item) => item.categoryId === category.id);
    budgetDrafts[category.id] = existing ? existing.amount : null;
    budgetInputs[category.id] = existing ? formatNumber(existing.amount) : "";
    targetInputs[category.id] =
      existing?.targetAmount == null ? "" : formatNumber(existing.targetAmount);
  });
};

watch(
  () => budget.budgets,
  () => syncDrafts(),
  { deep: true }
);
watch(
  () => budget.categories,
  () => syncDrafts(),
  { deep: true }
);
watch(
  () => selectedMonth.value,
  async (value) => {
    if (value && value !== budget.month) {
      await budget.setMonth(value);
    }
  }
);
watch(
  () => [selectedYear.value, selectedMonthValue.value],
  () => {
    const year = selectedYear.value;
    const month = selectedMonthValue.value;
    if (Number.isFinite(year) && Number.isFinite(month)) {
      selectedMonth.value = `${year}-${String(month).padStart(2, "0")}`;
    }
  }
);

onMounted(async () => {
  await budget.fetchAll();
  selectedMonth.value = budget.month;
  selectedYear.value = Number(budget.month.split("-")[0]);
  selectedMonthValue.value = Number(budget.month.split("-")[1]);
  syncDrafts();
  await loadPayeeData();
});

const handleAddCategory = async () => {
  if (!newCategory.value.trim()) return;
  const created = await budget.createCategoryWithRecurring(
    newCategory.value.trim(),
    newCategoryRecurring.value
  );
  if (created && newCategoryAmountValue.value != null && !Number.isNaN(newCategoryAmountValue.value)) {
    await budget.setCategoryBudget(created.id, Math.max(0, Math.round(newCategoryAmountValue.value)));
  }
  newCategory.value = "";
  newCategoryRecurring.value = false;
  newCategoryAmountInput.value = "";
  newCategoryAmountValue.value = null;
  syncDrafts();
};

const saveBudget = async (categoryId: string) => {
  const amount = budgetDrafts[categoryId];
  if (amount == null || Number.isNaN(amount)) return;
  await budget.setCategoryBudget(categoryId, Math.max(0, Math.round(amount)));
  budgetInputs[categoryId] = formatNumber(budgetDrafts[categoryId] ?? 0);
};

const removeCategory = async (categoryId: string) => {
  await budget.deleteCategory(categoryId);
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);

const parseNumber = (value: string) => {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits);
};

const targetInputs = reactive<Record<string, string>>({});

const onTargetInput = (categoryId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  targetInputs[categoryId] = target.value;
};

const onTargetBlur = (categoryId: string) => {
  const parsed = parseNumber(targetInputs[categoryId] ?? "");
  targetInputs[categoryId] = parsed == null ? "" : formatNumber(parsed);
};

const saveTarget = async (categoryId: string) => {
  const parsed = parseNumber(targetInputs[categoryId] ?? "");
  await budget.setCategoryTarget(categoryId, parsed == null ? null : Math.round(parsed));
  syncDrafts();
};

const spentByCategory = computed(() => {
  const map = new Map<string, number>();
  budget.spendsForMonth.forEach((spend) => {
    map.set(spend.categoryId, (map.get(spend.categoryId) ?? 0) + spend.amount);
  });
  return map;
});

const budgetByCategory = computed(() => budget.budgetByCategory);

const filteredCategories = computed(() => {
  const query = globalSearch.value.trim().toLowerCase();
  if (!query) return budget.categories;
  return budget.categories.filter((category) => category.name.toLowerCase().includes(query));
});

const filteredSpends = computed(() => {
  const query = globalSearch.value.trim().toLowerCase();
  if (!query) return budget.spendsForMonth;
  return budget.spendsForMonth.filter((spend) => {
    const payee = spend.payeeDisplay ?? spend.payeeName ?? "";
    return (
      spend.category.name.toLowerCase().includes(query) ||
      payee.toLowerCase().includes(query) ||
      (spend.notes ?? "").toLowerCase().includes(query)
    );
  });
});

const clearSearch = () => {
  globalSearch.value = "";
};

const progressPercent = (categoryId: string) => {
  const target = budgetByCategory.value.get(categoryId)?.targetAmount;
  if (!target) return 0;
  const spent = spentByCategory.value.get(categoryId) ?? 0;
  const percent = Math.round((spent / target) * 100);
  return Math.max(0, percent);
};

const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
];

const yearOptions = Array.from({ length: 11 }, (_, index) => new Date().getFullYear() - 5 + index);

const shiftMonth = (delta: number) => {
  const date = new Date(Date.UTC(selectedYear.value, selectedMonthValue.value - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + delta);
  selectedYear.value = date.getUTCFullYear();
  selectedMonthValue.value = date.getUTCMonth() + 1;
};

const onNewCategoryAmountInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  newCategoryAmountInput.value = target.value;
  newCategoryAmountValue.value = parseNumber(target.value);
};

const onNewCategoryAmountBlur = () => {
  newCategoryAmountInput.value =
    newCategoryAmountValue.value == null ? "" : formatNumber(newCategoryAmountValue.value);
};

const spendForm = reactive({
  categoryId: "",
  spentAt: new Date().toISOString().slice(0, 10),
  notes: "",
  recurring: false,
  payeeName: ""
});
const spendAmountInput = ref("");
const spendAmountValue = ref<number | null>(null);
const spendError = ref("");
const globalSearch = ref("");

const incomeForm = reactive({
  receivedAt: new Date().toISOString().slice(0, 10),
  notes: ""
});
const incomeAmountInput = ref("");
const incomeAmountValue = ref<number | null>(null);

const payeeRules = ref<PayeeRule[]>([]);
const payeeRenames = ref<PayeeRename[]>([]);
const payeeRuleForm = reactive({ matchText: "", categoryId: "" });
const payeeRenameForm = reactive({ matchText: "", renameTo: "" });
const twoFactorSetup = ref<TwoFactorSetup | null>(null);
const twoFactorOtp = ref("");
const twoFactorStatus = ref("");
const showDisableTwoFactor = ref(false);
const disableTwoFactorOtp = ref("");


const onBudgetInput = (categoryId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  budgetInputs[categoryId] = target.value;
  const parsed = parseNumber(target.value);
  budgetDrafts[categoryId] = parsed;
};

const onBudgetBlur = (categoryId: string) => {
  const value = budgetDrafts[categoryId];
  budgetInputs[categoryId] = value == null ? "" : formatNumber(value);
};

const onSpendAmountInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  spendAmountInput.value = target.value;
  spendAmountValue.value = parseNumber(target.value);
};

const onSpendAmountBlur = () => {
  spendAmountInput.value =
    spendAmountValue.value == null ? "" : formatNumber(spendAmountValue.value);
};

const onIncomeAmountInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  incomeAmountInput.value = target.value;
  incomeAmountValue.value = parseNumber(target.value);
};

const onIncomeAmountBlur = () => {
  incomeAmountInput.value =
    incomeAmountValue.value == null ? "" : formatNumber(incomeAmountValue.value);
};

const handleAddSpend = async () => {
  if (!spendForm.spentAt) return;
  if (spendAmountValue.value == null || Number.isNaN(spendAmountValue.value)) return;
  spendError.value = "";
  try {
    await budget.createSpend({
      categoryId: spendForm.categoryId || undefined,
      spentAt: spendForm.spentAt,
      amount: Math.max(0, Math.round(spendAmountValue.value)),
      notes: spendForm.notes.trim() || undefined,
      recurring: spendForm.recurring,
      payeeName: spendForm.payeeName.trim() || undefined
    });
  } catch (error) {
    spendError.value = error instanceof Error ? error.message : "Unable to add spend";
    return;
  }
  spendForm.notes = "";
  spendForm.recurring = false;
  spendForm.payeeName = "";
  spendAmountInput.value = "";
  spendAmountValue.value = null;
};

const handleAddIncome = async () => {
  if (!incomeForm.receivedAt) return;
  if (incomeAmountValue.value == null || Number.isNaN(incomeAmountValue.value)) return;
  await budget.createIncome({
    receivedAt: incomeForm.receivedAt,
    amount: Math.max(0, Math.round(incomeAmountValue.value)),
    notes: incomeForm.notes.trim() || undefined
  });
  incomeForm.notes = "";
  incomeAmountInput.value = "";
  incomeAmountValue.value = null;
};

const removeIncome = async (id: string) => {
  await budget.deleteIncome(id);
};


const loadPayeeData = async () => {
  const [rules, renames] = await Promise.all([api.getPayeeRules(), api.getPayeeRenames()]);
  payeeRules.value = rules;
  payeeRenames.value = renames;
};

const handleAddPayeeRule = async () => {
  if (!payeeRuleForm.matchText.trim() || !payeeRuleForm.categoryId) return;
  const rule = await api.createPayeeRule({
    matchText: payeeRuleForm.matchText.trim(),
    categoryId: payeeRuleForm.categoryId
  });
  payeeRules.value.unshift(rule);
  payeeRuleForm.matchText = "";
  payeeRuleForm.categoryId = "";
};

const removePayeeRule = async (id: string) => {
  await api.deletePayeeRule(id);
  payeeRules.value = payeeRules.value.filter((rule) => rule.id !== id);
};

const handleAddPayeeRename = async () => {
  if (!payeeRenameForm.matchText.trim() || !payeeRenameForm.renameTo.trim()) return;
  const rename = await api.createPayeeRename({
    matchText: payeeRenameForm.matchText.trim(),
    renameTo: payeeRenameForm.renameTo.trim()
  });
  payeeRenames.value.unshift(rename);
  payeeRenameForm.matchText = "";
  payeeRenameForm.renameTo = "";
};

const removePayeeRename = async (id: string) => {
  await api.deletePayeeRename(id);
  payeeRenames.value = payeeRenames.value.filter((rename) => rename.id !== id);
};

const startTwoFactor = async () => {
  twoFactorStatus.value = "";
  try {
    twoFactorSetup.value = await api.setupTwoFactor();
  } catch (error) {
    twoFactorStatus.value = error instanceof Error ? error.message : "Unable to start 2FA";
  }
};

const verifyTwoFactor = async () => {
  if (!twoFactorOtp.value.trim()) return;
  twoFactorStatus.value = "";
  try {
    await api.verifyTwoFactor(twoFactorOtp.value.trim());
    twoFactorStatus.value = "Two-factor authentication enabled.";
    twoFactorSetup.value = null;
    twoFactorOtp.value = "";
    showDisableTwoFactor.value = false;
  } catch (error) {
    twoFactorStatus.value = error instanceof Error ? error.message : "Invalid code";
  }
};

const toggleDisableTwoFactor = () => {
  showDisableTwoFactor.value = !showDisableTwoFactor.value;
};

const disableTwoFactor = async () => {
  if (!disableTwoFactorOtp.value.trim()) return;
  twoFactorStatus.value = "";
  try {
    await api.disableTwoFactor(disableTwoFactorOtp.value.trim());
    twoFactorStatus.value = "Two-factor authentication disabled.";
    disableTwoFactorOtp.value = "";
    showDisableTwoFactor.value = false;
  } catch (error) {
    twoFactorStatus.value = error instanceof Error ? error.message : "Invalid code";
  }
};

const removeSpend = async (id: string) => {
  await budget.deleteSpend(id);
};

</script>

<style scoped lang="scss">
.overview {
  display: grid;
  gap: 2rem;
}

.overview__summary {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: minmax(240px, 280px) 1fr;
  align-items: start;
}

.overview__grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  color: var(--muted-text);
}

h2 {
  margin: 0.4rem 0 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
}

.negative {
  color: var(--danger);
}

.summary-card {
  background: var(--surface);
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: var(--shadow-soft);
  display: grid;
}

.summary-card--metrics {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  align-items: start;
}

@media (max-width: 900px) {
  .overview__summary {
    grid-template-columns: 1fr;
  }
}

.month-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  background: rgba(15, 23, 42, 0.03);
  border-radius: 1.25rem;
  padding: 0.6rem 0.8rem;
}

.month-picker__selects {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.month-picker select {
  padding: 0.45rem 0.6rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(15, 23, 42, 0.15);
  font: inherit;
  background: #fff;
}



.overview__card {
  background: var(--surface);
  border-radius: 1.5rem;
  padding: 1.5rem;
  box-shadow: var(--shadow-soft);

  h3 {
    margin-top: 0;
  }
}

.overview__card--accent {
  background: linear-gradient(145deg, rgba(245, 209, 108, 0.35), rgba(255, 255, 255, 0.8));

  ul {
    margin: 0.8rem 0 0;
    padding-left: 1.2rem;
  }
}

.muted {
  color: var(--muted-text);
  margin-block: 0.4rem;
}

.error {
  margin-top: 1rem;
  padding: 0.6rem 0.8rem;
  border-radius: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.empty {
  margin-top: 1rem;
  color: var(--muted-text);
}

.search-input {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(15, 23, 42, 0.15);
  font: inherit;
  margin-top: 0.75rem;
}

.category-form {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  margin-top: 1rem;

  input {
    padding: 0.6rem 0.8rem;
    border-radius: 0.9rem;
    border: 1px solid rgba(15, 23, 42, 0.15);
    font: inherit;
    min-width: 0;
  }

  button {
    border: none;
    border-radius: 999px;
    padding: 0.6rem 1rem;
    background: var(--accent);
    color: var(--surface);
    font-weight: 600;
    cursor: pointer;
  }
}

.category-form__actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

@media (max-width: 720px) {
  .category-form {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .category-form button {
    width: 100%;
  }
}

.category-list {
  margin-top: 1.5rem;
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.category-row {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.04);
  width: 100%;
  box-sizing: border-box;
}

.category-row__info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.category-row__info .ghost {
  margin-left: auto;
}

.category-row__budget {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;

  input {
    padding: 0.5rem 0.7rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(15, 23, 42, 0.15);
    font: inherit;
    background: #fff;
    min-width: 0;
  }

  button {
    border: none;
    border-radius: 999px;
    padding: 0.5rem 0.9rem;
    background: var(--accent-strong);
    color: var(--surface);
    font-weight: 600;
    cursor: pointer;
  }
}

.category-row__rollover {
  font-size: 0.85rem;
  color: var(--muted-text);
}

.category-row__target {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;

  input {
    padding: 0.5rem 0.7rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(15, 23, 42, 0.15);
    font: inherit;
    background: #fff;
    min-width: 0;
  }

  button {
    border: none;
    border-radius: 999px;
    padding: 0.5rem 0.9rem;
    background: var(--accent);
    color: var(--surface);
    font-weight: 600;
    cursor: pointer;
  }
}

.category-row__progress {
  display: grid;
  gap: 0.5rem;
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: var(--muted-text);
}

.progress-bar {
  height: 0.5rem;
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar__fill {
  display: block;
  height: 100%;
  background: linear-gradient(130deg, var(--accent), var(--accent-strong));
}

.currency {
  font-weight: 700;
}

.ghost {
  border: none;
  background: transparent;
  color: var(--muted-text);
  cursor: pointer;
  font-size: 0.85rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: var(--muted-text);
}

.badge {
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.spend-form {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;

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

.spend-hint {
  font-size: 0.85rem;
}

.spend-form__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}


.spend-list {
  margin-top: 1.25rem;
  display: grid;
  gap: 0.85rem;
  min-width: 0;
}

.spend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.04);
  width: 100%;
  box-sizing: border-box;
  flex-wrap: wrap;
}

.spend-row__right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  flex-wrap: wrap;
}

.rule-form {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;

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
    padding: 0.55rem 0.9rem;
    background: var(--accent);
    color: var(--surface);
    font-weight: 600;
    cursor: pointer;
    justify-self: start;
  }
}

.rule-list {
  margin-top: 1rem;
  display: grid;
  gap: 0.75rem;
}

.rule-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 0.9rem;
  border-radius: 0.9rem;
  background: rgba(15, 23, 42, 0.04);
}

.twofa {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  align-items: center;
}

.twofa img {
  width: 180px;
  height: 180px;
  border-radius: 1rem;
  background: #fff;
  padding: 0.5rem;
  box-shadow: var(--shadow-soft);
}

.twofa__details {
  display: grid;
  gap: 0.75rem;
}

.twofa__verify {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;

  input {
    padding: 0.6rem 0.8rem;
    border-radius: 0.9rem;
    border: 1px solid rgba(15, 23, 42, 0.15);
    font: inherit;
  }
}

.twofa__actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.twofa__disable {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.btn {
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1rem;
  background: var(--accent);
  color: var(--surface);
  font-weight: 600;
  cursor: pointer;
}

.mono {
  font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.9rem;
  background: rgba(15, 23, 42, 0.06);
  padding: 0.4rem 0.6rem;
  border-radius: 0.6rem;
  word-break: break-all;
  overflow-wrap: anywhere;
}
</style>
