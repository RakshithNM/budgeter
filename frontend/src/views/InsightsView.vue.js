import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Chart } from "chart.js/auto";
import { api } from "../lib/api";
import { useBudgetStore } from "../store";
const budget = useBudgetStore();
const isLoading = ref(false);
const byCategory = ref([]);
const trend = ref([]);
const cashflowTrend = ref([]);
const netWorthTrend = ref([]);
const accounts = ref([]);
const categoryChartEl = ref(null);
const trendChartEl = ref(null);
const netWorthChartEl = ref(null);
const budgetChartEl = ref(null);
const cashflowChartEl = ref(null);
const netWorthTrendChartEl = ref(null);
let categoryChart = null;
let trendChart = null;
let netWorthChart = null;
let budgetChart = null;
let cashflowChart = null;
let netWorthTrendChart = null;
const accountForm = ref({
    name: "",
    type: "ASSET"
});
const accountBalanceInput = ref("");
const accountBalanceValue = ref(null);
const editingAccountId = ref(null);
const editForm = ref({
    name: "",
    type: "ASSET"
});
const editBalanceInput = ref("");
const editBalanceValue = ref(null);
const formatCurrency = (value) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
}).format(value);
const formatNumber = (value) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const parseNumber = (value) => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits)
        return null;
    return Number(digits);
};
const reportMonthLabel = computed(() => {
    const [year, month] = budget.month.split("-").map(Number);
    if (!year || !month)
        return budget.month;
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric"
    });
});
const totalSpend = computed(() => byCategory.value.reduce((sum, item) => sum + item.total, 0));
const percentOfTotal = (value) => {
    if (!totalSpend.value)
        return 0;
    return Math.round((value / totalSpend.value) * 100);
};
const assetTotal = computed(() => accounts.value
    .filter((account) => account.type === "ASSET")
    .reduce((sum, account) => sum + account.balance, 0));
const liabilityTotal = computed(() => accounts.value
    .filter((account) => account.type === "LIABILITY")
    .reduce((sum, account) => sum + account.balance, 0));
const netWorth = computed(() => assetTotal.value - liabilityTotal.value);
const buildCategoryChart = () => {
    if (!categoryChartEl.value)
        return;
    const labels = byCategory.value.map((item) => item.categoryName);
    const data = byCategory.value.map((item) => item.total);
    if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }
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
};
const buildTrendChart = () => {
    if (!trendChartEl.value)
        return;
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
    }
    else {
        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = data;
        trendChart.update();
    }
};
const buildCashflowChart = () => {
    if (!cashflowChartEl.value)
        return;
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
    }
    else {
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
    if (!budgetChartEl.value)
        return;
    const budgetMap = new Map(budget.budgets.map((item) => [item.categoryId, item]));
    const categoryLabels = budget.categories.map((category) => category.name);
    const budgetData = budget.categories.map((category) => budgetMap.get(category.id)?.effectiveAmount ?? budgetMap.get(category.id)?.amount ?? 0);
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
    }
    else {
        budgetChart.data.labels = categoryLabels;
        budgetChart.data.datasets[0].data = budgetData;
        budgetChart.data.datasets[1].data = spendData;
        budgetChart.update();
    }
};
const buildNetWorthChart = () => {
    if (!netWorthChartEl.value)
        return;
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
    }
    else {
        netWorthChart.data.datasets[0].data = data;
        netWorthChart.update();
    }
};
const buildNetWorthTrendChart = () => {
    if (!netWorthTrendChartEl.value)
        return;
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
    }
    else {
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
        const formatMonth = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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
    }
    finally {
        isLoading.value = false;
    }
};
const loadAccounts = async () => {
    accounts.value = await api.getAccounts();
    buildNetWorthChart();
};
const onAccountBalanceInput = (event) => {
    const target = event.target;
    accountBalanceInput.value = target.value;
    accountBalanceValue.value = parseNumber(target.value);
};
const onAccountBalanceBlur = () => {
    accountBalanceInput.value =
        accountBalanceValue.value == null ? "" : formatNumber(accountBalanceValue.value);
};
const handleAddAccount = async () => {
    if (!accountForm.value.name.trim())
        return;
    if (accountBalanceValue.value == null || Number.isNaN(accountBalanceValue.value))
        return;
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
const removeAccount = async (id) => {
    await api.deleteAccount(id);
    accounts.value = accounts.value.filter((account) => account.id !== id);
    buildNetWorthChart();
};
const startEditAccount = (account) => {
    editingAccountId.value = account.id;
    editForm.value = { name: account.name, type: account.type };
    editBalanceValue.value = account.balance;
    editBalanceInput.value = formatNumber(account.balance);
};
const onEditBalanceInput = (event) => {
    const target = event.target;
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
const saveAccount = async (id) => {
    if (!editForm.value.name.trim())
        return;
    if (editBalanceValue.value == null || Number.isNaN(editBalanceValue.value))
        return;
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
watch(() => budget.month, async () => {
    await loadReports();
    buildBudgetChart();
});
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
watch(() => [budget.budgets, budget.categories], () => {
    buildBudgetChart();
}, { deep: true });
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "insights" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "insights__panel insights__panel--category" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.reportMonthLabel);
if (__VLS_ctx.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "muted" },
    });
}
else if (__VLS_ctx.byCategory.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "muted" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chart-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
        ref: "categoryChartEl",
        height: "220",
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.isLoading) }, null, null);
    /** @type {typeof __VLS_ctx.categoryChartEl} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "legend" },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.byCategory))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (item.categoryId),
            ...{ class: "legend-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item.categoryName);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (__VLS_ctx.formatCurrency(item.total));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "muted" },
        });
        (__VLS_ctx.percentOfTotal(item.total));
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "insights__panel insights__panel--trend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.trend.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "trendChartEl",
    height: "240",
});
/** @type {typeof __VLS_ctx.trendChartEl} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "insights__panel insights__panel--cashflow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.cashflowTrend.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "cashflowChartEl",
    height: "240",
});
/** @type {typeof __VLS_ctx.cashflowChartEl} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "insights__panel insights__panel--budget" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.reportMonthLabel);
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "budgetChartEl",
    height: "240",
});
/** @type {typeof __VLS_ctx.budgetChartEl} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "insights__panel insights__panel--accent insights__panel--networth" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.formatCurrency(__VLS_ctx.netWorth));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "networth-grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "netWorthChartEl",
    height: "200",
});
/** @type {typeof __VLS_ctx.netWorthChartEl} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "networth-list" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "networth-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.formatCurrency(__VLS_ctx.assetTotal));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "networth-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.formatCurrency(__VLS_ctx.liabilityTotal));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "networth-row networth-row--total" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.formatCurrency(__VLS_ctx.netWorth));
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.handleAddAccount) },
    ...{ class: "account-form" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    value: (__VLS_ctx.accountForm.name),
    type: "text",
    placeholder: "Account name",
    required: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.accountForm.type),
    required: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "ASSET",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "LIABILITY",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onInput: (__VLS_ctx.onAccountBalanceInput) },
    ...{ onBlur: (__VLS_ctx.onAccountBalanceBlur) },
    value: (__VLS_ctx.accountBalanceInput),
    inputmode: "numeric",
    placeholder: "Balance",
    required: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "account-list" },
});
for (const [account] of __VLS_getVForSourceType((__VLS_ctx.accounts))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (account.id),
        ...{ class: "account-row" },
    });
    if (__VLS_ctx.editingAccountId !== account.id) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (account.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "muted" },
        });
        (account.type === 'ASSET' ? 'Asset' : 'Liability');
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "account-edit" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            value: (__VLS_ctx.editForm.name),
            type: "text",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.editForm.type),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "ASSET",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "LIABILITY",
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "account-row__right" },
    });
    if (__VLS_ctx.editingAccountId !== account.id) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.formatCurrency(account.balance));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onInput: (__VLS_ctx.onEditBalanceInput) },
            ...{ onBlur: (__VLS_ctx.onEditBalanceBlur) },
            value: (__VLS_ctx.editBalanceInput),
            inputmode: "numeric",
        });
    }
    if (__VLS_ctx.editingAccountId !== account.id) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.editingAccountId !== account.id))
                        return;
                    __VLS_ctx.startEditAccount(account);
                } },
            ...{ class: "ghost" },
            type: "button",
        });
    }
    if (__VLS_ctx.editingAccountId !== account.id) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.editingAccountId !== account.id))
                        return;
                    __VLS_ctx.removeAccount(account.id);
                } },
            ...{ class: "ghost" },
            type: "button",
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.editingAccountId !== account.id))
                        return;
                    __VLS_ctx.saveAccount(account.id);
                } },
            ...{ class: "ghost" },
            type: "button",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.cancelEdit) },
            ...{ class: "ghost" },
            type: "button",
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "insights__panel insights__panel--networth-trend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "muted" },
});
(__VLS_ctx.netWorthTrend.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "netWorthTrendChartEl",
    height: "240",
});
/** @type {typeof __VLS_ctx.netWorthTrendChartEl} */ ;
/** @type {__VLS_StyleScopedClasses['insights']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel--category']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['legend']} */ ;
/** @type {__VLS_StyleScopedClasses['legend-row']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel--trend']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel--cashflow']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel--budget']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel--accent']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel--networth']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['networth-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['networth-list']} */ ;
/** @type {__VLS_StyleScopedClasses['networth-row']} */ ;
/** @type {__VLS_StyleScopedClasses['networth-row']} */ ;
/** @type {__VLS_StyleScopedClasses['networth-row']} */ ;
/** @type {__VLS_StyleScopedClasses['networth-row--total']} */ ;
/** @type {__VLS_StyleScopedClasses['account-form']} */ ;
/** @type {__VLS_StyleScopedClasses['account-list']} */ ;
/** @type {__VLS_StyleScopedClasses['account-row']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['account-edit']} */ ;
/** @type {__VLS_StyleScopedClasses['account-row__right']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['insights__panel--networth-trend']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            isLoading: isLoading,
            byCategory: byCategory,
            trend: trend,
            cashflowTrend: cashflowTrend,
            netWorthTrend: netWorthTrend,
            accounts: accounts,
            categoryChartEl: categoryChartEl,
            trendChartEl: trendChartEl,
            netWorthChartEl: netWorthChartEl,
            budgetChartEl: budgetChartEl,
            cashflowChartEl: cashflowChartEl,
            netWorthTrendChartEl: netWorthTrendChartEl,
            accountForm: accountForm,
            accountBalanceInput: accountBalanceInput,
            editingAccountId: editingAccountId,
            editForm: editForm,
            editBalanceInput: editBalanceInput,
            formatCurrency: formatCurrency,
            reportMonthLabel: reportMonthLabel,
            percentOfTotal: percentOfTotal,
            assetTotal: assetTotal,
            liabilityTotal: liabilityTotal,
            netWorth: netWorth,
            onAccountBalanceInput: onAccountBalanceInput,
            onAccountBalanceBlur: onAccountBalanceBlur,
            handleAddAccount: handleAddAccount,
            removeAccount: removeAccount,
            startEditAccount: startEditAccount,
            onEditBalanceInput: onEditBalanceInput,
            onEditBalanceBlur: onEditBalanceBlur,
            cancelEdit: cancelEdit,
            saveAccount: saveAccount,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=InsightsView.vue.js.map