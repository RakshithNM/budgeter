import { computed, onMounted, reactive, ref, watch } from "vue";
import { api } from "../lib/api";
import { useBudgetStore } from "../store";
const budget = useBudgetStore();
const newCategory = ref("");
const newCategoryRecurring = ref(false);
const newCategoryAmountInput = ref("");
const newCategoryAmountValue = ref(null);
const selectedMonth = ref(budget.month);
const selectedYear = ref(Number(budget.month.split("-")[0]));
const selectedMonthValue = ref(Number(budget.month.split("-")[1]));
const budgetDrafts = reactive({});
const budgetInputs = reactive({});
const formatCurrency = (value) => new Intl.NumberFormat("en-IN", {
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
watch(() => budget.budgets, () => syncDrafts(), { deep: true });
watch(() => budget.categories, () => syncDrafts(), { deep: true });
watch(() => selectedMonth.value, async (value) => {
    if (value && value !== budget.month) {
        await budget.setMonth(value);
    }
});
watch(() => [selectedYear.value, selectedMonthValue.value], () => {
    const year = selectedYear.value;
    const month = selectedMonthValue.value;
    if (Number.isFinite(year) && Number.isFinite(month)) {
        selectedMonth.value = `${year}-${String(month).padStart(2, "0")}`;
    }
});
onMounted(async () => {
    await budget.fetchAll();
    selectedMonth.value = budget.month;
    selectedYear.value = Number(budget.month.split("-")[0]);
    selectedMonthValue.value = Number(budget.month.split("-")[1]);
    syncDrafts();
    await loadPayeeData();
});
const handleAddCategory = async () => {
    if (!newCategory.value.trim())
        return;
    const created = await budget.createCategoryWithRecurring(newCategory.value.trim(), newCategoryRecurring.value);
    if (created && newCategoryAmountValue.value != null && !Number.isNaN(newCategoryAmountValue.value)) {
        await budget.setCategoryBudget(created.id, Math.max(0, Math.round(newCategoryAmountValue.value)));
    }
    newCategory.value = "";
    newCategoryRecurring.value = false;
    newCategoryAmountInput.value = "";
    newCategoryAmountValue.value = null;
    syncDrafts();
};
const saveBudget = async (categoryId) => {
    const amount = budgetDrafts[categoryId];
    if (amount == null || Number.isNaN(amount))
        return;
    await budget.setCategoryBudget(categoryId, Math.max(0, Math.round(amount)));
    budgetInputs[categoryId] = formatNumber(budgetDrafts[categoryId] ?? 0);
};
const removeCategory = async (categoryId) => {
    await budget.deleteCategory(categoryId);
};
const formatNumber = (value) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const parseNumber = (value) => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits)
        return null;
    return Number(digits);
};
const targetInputs = reactive({});
const onTargetInput = (categoryId, event) => {
    const target = event.target;
    targetInputs[categoryId] = target.value;
};
const onTargetBlur = (categoryId) => {
    const parsed = parseNumber(targetInputs[categoryId] ?? "");
    targetInputs[categoryId] = parsed == null ? "" : formatNumber(parsed);
};
const saveTarget = async (categoryId) => {
    const parsed = parseNumber(targetInputs[categoryId] ?? "");
    await budget.setCategoryTarget(categoryId, parsed == null ? null : Math.round(parsed));
    syncDrafts();
};
const spentByCategory = computed(() => {
    const map = new Map();
    budget.spendsForMonth.forEach((spend) => {
        map.set(spend.categoryId, (map.get(spend.categoryId) ?? 0) + spend.amount);
    });
    return map;
});
const budgetByCategory = computed(() => budget.budgetByCategory);
const filteredCategories = computed(() => {
    const query = globalSearch.value.trim().toLowerCase();
    if (!query)
        return budget.categories;
    return budget.categories.filter((category) => category.name.toLowerCase().includes(query));
});
const filteredSpends = computed(() => {
    const query = globalSearch.value.trim().toLowerCase();
    if (!query)
        return budget.spendsForMonth;
    return budget.spendsForMonth.filter((spend) => {
        const payee = spend.payeeDisplay ?? spend.payeeName ?? "";
        return (spend.category.name.toLowerCase().includes(query) ||
            payee.toLowerCase().includes(query) ||
            (spend.notes ?? "").toLowerCase().includes(query));
    });
});
const clearSearch = () => {
    globalSearch.value = "";
};
const progressPercent = (categoryId) => {
    const target = budgetByCategory.value.get(categoryId)?.targetAmount;
    if (!target)
        return 0;
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
const shiftMonth = (delta) => {
    const date = new Date(Date.UTC(selectedYear.value, selectedMonthValue.value - 1, 1));
    date.setUTCMonth(date.getUTCMonth() + delta);
    selectedYear.value = date.getUTCFullYear();
    selectedMonthValue.value = date.getUTCMonth() + 1;
};
const onNewCategoryAmountInput = (event) => {
    const target = event.target;
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
const spendAmountValue = ref(null);
const spendError = ref("");
const globalSearch = ref("");
const incomeForm = reactive({
    receivedAt: new Date().toISOString().slice(0, 10),
    notes: ""
});
const incomeAmountInput = ref("");
const incomeAmountValue = ref(null);
const payeeRules = ref([]);
const payeeRenames = ref([]);
const payeeRuleForm = reactive({ matchText: "", categoryId: "" });
const payeeRenameForm = reactive({ matchText: "", renameTo: "" });
const twoFactorSetup = ref(null);
const twoFactorOtp = ref("");
const twoFactorStatus = ref("");
const showDisableTwoFactor = ref(false);
const disableTwoFactorOtp = ref("");
const onBudgetInput = (categoryId, event) => {
    const target = event.target;
    budgetInputs[categoryId] = target.value;
    const parsed = parseNumber(target.value);
    budgetDrafts[categoryId] = parsed;
};
const onBudgetBlur = (categoryId) => {
    const value = budgetDrafts[categoryId];
    budgetInputs[categoryId] = value == null ? "" : formatNumber(value);
};
const onSpendAmountInput = (event) => {
    const target = event.target;
    spendAmountInput.value = target.value;
    spendAmountValue.value = parseNumber(target.value);
};
const onSpendAmountBlur = () => {
    spendAmountInput.value =
        spendAmountValue.value == null ? "" : formatNumber(spendAmountValue.value);
};
const onIncomeAmountInput = (event) => {
    const target = event.target;
    incomeAmountInput.value = target.value;
    incomeAmountValue.value = parseNumber(target.value);
};
const onIncomeAmountBlur = () => {
    incomeAmountInput.value =
        incomeAmountValue.value == null ? "" : formatNumber(incomeAmountValue.value);
};
const handleAddSpend = async () => {
    if (!spendForm.spentAt)
        return;
    if (spendAmountValue.value == null || Number.isNaN(spendAmountValue.value))
        return;
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
    }
    catch (error) {
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
    if (!incomeForm.receivedAt)
        return;
    if (incomeAmountValue.value == null || Number.isNaN(incomeAmountValue.value))
        return;
    await budget.createIncome({
        receivedAt: incomeForm.receivedAt,
        amount: Math.max(0, Math.round(incomeAmountValue.value)),
        notes: incomeForm.notes.trim() || undefined
    });
    incomeForm.notes = "";
    incomeAmountInput.value = "";
    incomeAmountValue.value = null;
};
const removeIncome = async (id) => {
    await budget.deleteIncome(id);
};
const loadPayeeData = async () => {
    const [rules, renames] = await Promise.all([api.getPayeeRules(), api.getPayeeRenames()]);
    payeeRules.value = rules;
    payeeRenames.value = renames;
};
const handleAddPayeeRule = async () => {
    if (!payeeRuleForm.matchText.trim() || !payeeRuleForm.categoryId)
        return;
    const rule = await api.createPayeeRule({
        matchText: payeeRuleForm.matchText.trim(),
        categoryId: payeeRuleForm.categoryId
    });
    payeeRules.value.unshift(rule);
    payeeRuleForm.matchText = "";
    payeeRuleForm.categoryId = "";
};
const removePayeeRule = async (id) => {
    await api.deletePayeeRule(id);
    payeeRules.value = payeeRules.value.filter((rule) => rule.id !== id);
};
const handleAddPayeeRename = async () => {
    if (!payeeRenameForm.matchText.trim() || !payeeRenameForm.renameTo.trim())
        return;
    const rename = await api.createPayeeRename({
        matchText: payeeRenameForm.matchText.trim(),
        renameTo: payeeRenameForm.renameTo.trim()
    });
    payeeRenames.value.unshift(rename);
    payeeRenameForm.matchText = "";
    payeeRenameForm.renameTo = "";
};
const removePayeeRename = async (id) => {
    await api.deletePayeeRename(id);
    payeeRenames.value = payeeRenames.value.filter((rename) => rename.id !== id);
};
const startTwoFactor = async () => {
    twoFactorStatus.value = "";
    try {
        twoFactorSetup.value = await api.setupTwoFactor();
    }
    catch (error) {
        twoFactorStatus.value = error instanceof Error ? error.message : "Unable to start 2FA";
    }
};
const verifyTwoFactor = async () => {
    if (!twoFactorOtp.value.trim())
        return;
    twoFactorStatus.value = "";
    try {
        await api.verifyTwoFactor(twoFactorOtp.value.trim());
        twoFactorStatus.value = "Two-factor authentication enabled.";
        twoFactorSetup.value = null;
        twoFactorOtp.value = "";
        showDisableTwoFactor.value = false;
    }
    catch (error) {
        twoFactorStatus.value = error instanceof Error ? error.message : "Invalid code";
    }
};
const toggleDisableTwoFactor = () => {
    showDisableTwoFactor.value = !showDisableTwoFactor.value;
};
const disableTwoFactor = async () => {
    if (!disableTwoFactorOtp.value.trim())
        return;
    twoFactorStatus.value = "";
    try {
        await api.disableTwoFactor(disableTwoFactorOtp.value.trim());
        twoFactorStatus.value = "Two-factor authentication disabled.";
        disableTwoFactorOtp.value = "";
        showDisableTwoFactor.value = false;
    }
    catch (error) {
        twoFactorStatus.value = error instanceof Error ? error.message : "Invalid code";
    }
};
const removeSpend = async (id) => {
    await budget.deleteSpend(id);
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['overview__summary']} */ ;
/** @type {__VLS_StyleScopedClasses['month-picker']} */ ;
/** @type {__VLS_StyleScopedClasses['category-form']} */ ;
/** @type {__VLS_StyleScopedClasses['category-form']} */ ;
/** @type {__VLS_StyleScopedClasses['category-row__info']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['twofa']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "overview" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overview__summary" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "summary-card summary-card--month" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "month-picker" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "month-picker__selects" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.selectedMonthValue),
});
for (const [month] of __VLS_getVForSourceType((__VLS_ctx.monthOptions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (month.value),
        value: (month.value),
    });
    (month.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.selectedYear),
});
for (const [year] of __VLS_getVForSourceType((__VLS_ctx.yearOptions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (year),
        value: (year),
    });
    (year);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "summary-card summary-card--metrics" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.formatCurrency(__VLS_ctx.budget.totalBudget));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.formatCurrency(__VLS_ctx.budget.totalIncome));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
    ...{ class: (__VLS_ctx.budget.rollingCashflowTotal < 0 ? 'negative' : '') },
});
(__VLS_ctx.formatCurrency(__VLS_ctx.budget.rollingCashflowTotal));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
    ...{ class: (__VLS_ctx.budget.cashflow < 0 ? 'negative' : '') },
});
(__VLS_ctx.formatCurrency(__VLS_ctx.budget.cashflow));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overview__grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overview__card overview__card--search" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    value: (__VLS_ctx.globalSearch),
    type: "text",
    placeholder: "Search payee, category, or notes",
    ...{ class: "search-input" },
});
if (__VLS_ctx.globalSearch) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearSearch) },
        ...{ class: "ghost" },
        type: "button",
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overview__card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.handleAddSpend) },
    ...{ class: "spend-form" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.spendForm.categoryId),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    disabled: true,
    value: "",
});
for (const [category] of __VLS_getVForSourceType((__VLS_ctx.budget.categories))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (category.id),
        value: (category.id),
    });
    (category.name);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "spend-hint muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    value: (__VLS_ctx.spendForm.payeeName),
    type: "text",
    placeholder: "Payee (optional)",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "spend-form__row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onInput: (__VLS_ctx.onSpendAmountInput) },
    ...{ onBlur: (__VLS_ctx.onSpendAmountBlur) },
    value: (__VLS_ctx.spendAmountInput),
    inputmode: "numeric",
    placeholder: "Amount",
    required: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "date",
    required: true,
});
(__VLS_ctx.spendForm.spentAt);
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "toggle" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "checkbox",
});
(__VLS_ctx.spendForm.recurring);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    value: (__VLS_ctx.spendForm.notes),
    type: "text",
    placeholder: "Notes (optional)",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
});
if (__VLS_ctx.spendError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "error" },
    });
    (__VLS_ctx.spendError);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "spend-list" },
});
for (const [spend] of __VLS_getVForSourceType((__VLS_ctx.filteredSpends))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (spend.id),
        ...{ class: "spend-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (spend.category.name);
    if (spend.recurring) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "muted" },
    });
    (new Date(spend.spentAt).toLocaleDateString("en-IN"));
    if (spend.payeeDisplay || spend.payeeName) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (spend.payeeDisplay ?? spend.payeeName);
    }
    if (spend.notes) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (spend.notes);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "spend-row__right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.formatCurrency(spend.amount));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removeSpend(spend.id);
            } },
        ...{ class: "ghost" },
        type: "button",
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overview__card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.handleAddCategory) },
    ...{ class: "category-form" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    value: (__VLS_ctx.newCategory),
    type: "text",
    placeholder: "New category name",
    required: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onInput: (__VLS_ctx.onNewCategoryAmountInput) },
    ...{ onBlur: (__VLS_ctx.onNewCategoryAmountBlur) },
    inputmode: "numeric",
    placeholder: "Budget amount",
});
(__VLS_ctx.newCategoryAmountInput);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "category-form__actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "toggle" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "checkbox",
});
(__VLS_ctx.newCategoryRecurring);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
});
if (__VLS_ctx.budget.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "error" },
    });
    (__VLS_ctx.budget.error);
}
if (__VLS_ctx.budget.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "muted" },
    });
}
if (__VLS_ctx.budget.categories.length === 0 && !__VLS_ctx.budget.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "category-list" },
});
for (const [category] of __VLS_getVForSourceType((__VLS_ctx.filteredCategories))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (category.id),
        ...{ class: "category-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "category-row__info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (category.name);
    if (category.recurring) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removeCategory(category.id);
            } },
        ...{ class: "ghost" },
        type: "button",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "category-row__budget" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "currency" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onInput: (...[$event]) => {
                __VLS_ctx.onBudgetInput(category.id, $event);
            } },
        ...{ onBlur: (...[$event]) => {
                __VLS_ctx.onBudgetBlur(category.id);
            } },
        value: (__VLS_ctx.budgetInputs[category.id]),
        inputmode: "numeric",
        placeholder: "0",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.saveBudget(category.id);
            } },
        type: "button",
    });
    if (__VLS_ctx.budgetByCategory.get(category.id)?.rolloverAmount !== 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "category-row__rollover" },
        });
        (__VLS_ctx.formatCurrency(__VLS_ctx.budgetByCategory.get(category.id)?.rolloverAmount ?? 0));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "category-row__target" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "currency" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onInput: (...[$event]) => {
                __VLS_ctx.onTargetInput(category.id, $event);
            } },
        ...{ onBlur: (...[$event]) => {
                __VLS_ctx.onTargetBlur(category.id);
            } },
        value: (__VLS_ctx.targetInputs[category.id]),
        inputmode: "numeric",
        placeholder: "Target",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.saveTarget(category.id);
            } },
        type: "button",
    });
    if (__VLS_ctx.budgetByCategory.get(category.id)?.targetAmount) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "category-row__progress" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "progress-meta" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.formatCurrency(__VLS_ctx.spentByCategory.get(category.id) ?? 0));
        (__VLS_ctx.formatCurrency(__VLS_ctx.budgetByCategory.get(category.id)?.targetAmount ?? 0));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.progressPercent(category.id));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "progress-bar" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span)({
            ...{ class: "progress-bar__fill" },
            ...{ style: ({ width: `${__VLS_ctx.progressPercent(category.id)}%` }) },
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overview__card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.handleAddIncome) },
    ...{ class: "spend-form" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "spend-form__row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onInput: (__VLS_ctx.onIncomeAmountInput) },
    ...{ onBlur: (__VLS_ctx.onIncomeAmountBlur) },
    value: (__VLS_ctx.incomeAmountInput),
    inputmode: "numeric",
    placeholder: "Amount",
    required: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "date",
    required: true,
});
(__VLS_ctx.incomeForm.receivedAt);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    value: (__VLS_ctx.incomeForm.notes),
    type: "text",
    placeholder: "Notes (optional)",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "spend-list" },
});
for (const [income] of __VLS_getVForSourceType((__VLS_ctx.budget.incomes))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (income.id),
        ...{ class: "spend-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "muted" },
    });
    (new Date(income.receivedAt).toLocaleDateString("en-IN"));
    if (income.notes) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (income.notes);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "spend-row__right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.formatCurrency(income.amount));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removeIncome(income.id);
            } },
        ...{ class: "ghost" },
        type: "button",
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overview__card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.handleAddPayeeRename) },
    ...{ class: "rule-form" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    value: (__VLS_ctx.payeeRenameForm.matchText),
    type: "text",
    placeholder: "Payee contains…",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    value: (__VLS_ctx.payeeRenameForm.renameTo),
    type: "text",
    placeholder: "Rename to",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "rule-list" },
});
for (const [rename] of __VLS_getVForSourceType((__VLS_ctx.payeeRenames))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (rename.id),
        ...{ class: "rule-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (rename.matchText);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "muted" },
    });
    (rename.renameTo);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removePayeeRename(rename.id);
            } },
        ...{ class: "ghost" },
        type: "button",
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.handleAddPayeeRule) },
    ...{ class: "rule-form" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    value: (__VLS_ctx.payeeRuleForm.matchText),
    type: "text",
    placeholder: "Payee contains…",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.payeeRuleForm.categoryId),
    required: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    disabled: true,
    value: "",
});
for (const [category] of __VLS_getVForSourceType((__VLS_ctx.budget.categories))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (category.id),
        value: (category.id),
    });
    (category.name);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "rule-list" },
});
for (const [rule] of __VLS_getVForSourceType((__VLS_ctx.payeeRules))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (rule.id),
        ...{ class: "rule-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (rule.matchText);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "muted" },
    });
    (rule.category.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removePayeeRule(rule.id);
            } },
        ...{ class: "ghost" },
        type: "button",
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overview__card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
if (__VLS_ctx.twoFactorStatus) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "muted" },
    });
    (__VLS_ctx.twoFactorStatus);
}
if (!__VLS_ctx.twoFactorSetup) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "twofa__actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.startTwoFactor) },
        ...{ class: "btn" },
        type: "button",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.toggleDisableTwoFactor) },
        ...{ class: "ghost" },
        type: "button",
    });
}
if (__VLS_ctx.twoFactorSetup) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "twofa" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
        src: (__VLS_ctx.twoFactorSetup.qrCode),
        alt: "2FA QR code",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "twofa__details" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "muted" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "mono" },
    });
    (__VLS_ctx.twoFactorSetup.secret);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "twofa__verify" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.twoFactorOtp),
        type: "text",
        inputmode: "numeric",
        placeholder: "Enter code",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.verifyTwoFactor) },
        ...{ class: "btn" },
        type: "button",
    });
    if (__VLS_ctx.showDisableTwoFactor) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "twofa__disable" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            value: (__VLS_ctx.disableTwoFactorOtp),
            type: "text",
            inputmode: "numeric",
            placeholder: "Enter code to disable",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.disableTwoFactor) },
            ...{ class: "ghost" },
            type: "button",
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overview__card overview__card--accent" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
/** @type {__VLS_StyleScopedClasses['overview']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__summary']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-card']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-card--month']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['month-picker']} */ ;
/** @type {__VLS_StyleScopedClasses['month-picker__selects']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-card']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-card--metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__card']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__card--search']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__card']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-form']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-form__row']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-list']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-row']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-row__right']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__card']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['category-form']} */ ;
/** @type {__VLS_StyleScopedClasses['category-form__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
/** @type {__VLS_StyleScopedClasses['category-list']} */ ;
/** @type {__VLS_StyleScopedClasses['category-row']} */ ;
/** @type {__VLS_StyleScopedClasses['category-row__info']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['category-row__budget']} */ ;
/** @type {__VLS_StyleScopedClasses['currency']} */ ;
/** @type {__VLS_StyleScopedClasses['category-row__rollover']} */ ;
/** @type {__VLS_StyleScopedClasses['category-row__target']} */ ;
/** @type {__VLS_StyleScopedClasses['currency']} */ ;
/** @type {__VLS_StyleScopedClasses['category-row__progress']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-bar__fill']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__card']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-form']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-form__row']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-list']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-row']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['spend-row__right']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__card']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-form']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-list']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-row']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-form']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-list']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-row']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__card']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['twofa__actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['twofa']} */ ;
/** @type {__VLS_StyleScopedClasses['twofa__details']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['mono']} */ ;
/** @type {__VLS_StyleScopedClasses['twofa__verify']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['twofa__disable']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__card']} */ ;
/** @type {__VLS_StyleScopedClasses['overview__card--accent']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            budget: budget,
            newCategory: newCategory,
            newCategoryRecurring: newCategoryRecurring,
            newCategoryAmountInput: newCategoryAmountInput,
            selectedYear: selectedYear,
            selectedMonthValue: selectedMonthValue,
            budgetInputs: budgetInputs,
            formatCurrency: formatCurrency,
            handleAddCategory: handleAddCategory,
            saveBudget: saveBudget,
            removeCategory: removeCategory,
            targetInputs: targetInputs,
            onTargetInput: onTargetInput,
            onTargetBlur: onTargetBlur,
            saveTarget: saveTarget,
            spentByCategory: spentByCategory,
            budgetByCategory: budgetByCategory,
            filteredCategories: filteredCategories,
            filteredSpends: filteredSpends,
            clearSearch: clearSearch,
            progressPercent: progressPercent,
            monthOptions: monthOptions,
            yearOptions: yearOptions,
            onNewCategoryAmountInput: onNewCategoryAmountInput,
            onNewCategoryAmountBlur: onNewCategoryAmountBlur,
            spendForm: spendForm,
            spendAmountInput: spendAmountInput,
            spendError: spendError,
            globalSearch: globalSearch,
            incomeForm: incomeForm,
            incomeAmountInput: incomeAmountInput,
            payeeRules: payeeRules,
            payeeRenames: payeeRenames,
            payeeRuleForm: payeeRuleForm,
            payeeRenameForm: payeeRenameForm,
            twoFactorSetup: twoFactorSetup,
            twoFactorOtp: twoFactorOtp,
            twoFactorStatus: twoFactorStatus,
            showDisableTwoFactor: showDisableTwoFactor,
            disableTwoFactorOtp: disableTwoFactorOtp,
            onBudgetInput: onBudgetInput,
            onBudgetBlur: onBudgetBlur,
            onSpendAmountInput: onSpendAmountInput,
            onSpendAmountBlur: onSpendAmountBlur,
            onIncomeAmountInput: onIncomeAmountInput,
            onIncomeAmountBlur: onIncomeAmountBlur,
            handleAddSpend: handleAddSpend,
            handleAddIncome: handleAddIncome,
            removeIncome: removeIncome,
            handleAddPayeeRule: handleAddPayeeRule,
            removePayeeRule: removePayeeRule,
            handleAddPayeeRename: handleAddPayeeRename,
            removePayeeRename: removePayeeRename,
            startTwoFactor: startTwoFactor,
            verifyTwoFactor: verifyTwoFactor,
            toggleDisableTwoFactor: toggleDisableTwoFactor,
            disableTwoFactor: disableTwoFactor,
            removeSpend: removeSpend,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=OverviewView.vue.js.map