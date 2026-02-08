import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../lib/api";
import { useAuthStore } from "../store";
const auth = useAuthStore();
const router = useRouter();
const setupComplete = ref(true);
const otpRequired = ref(false);
const form = reactive({
    email: "",
    password: "",
    name: "",
    otp: ""
});
const handleSubmit = async () => {
    if (setupComplete.value) {
        await auth.login(form.email, form.password, otpRequired.value ? form.otp : undefined);
        if (auth.error === "otp_required") {
            otpRequired.value = true;
            return;
        }
        if (auth.error === "invalid_otp") {
            otpRequired.value = true;
            return;
        }
    }
    else {
        await auth.setup(form.email, form.password, form.name || undefined);
    }
    if (auth.isAuthenticated) {
        await router.replace("/app");
    }
};
onMounted(async () => {
    const status = await api.authStatus();
    setupComplete.value = status.setupComplete;
});
const friendlyError = computed(() => {
    if (auth.error === "otp_required")
        return "Enter your authenticator code to continue.";
    if (auth.error === "invalid_otp")
        return "Invalid code. Try again.";
    return auth.error;
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['auth__card']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "auth" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "auth__card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.setupComplete ? "Sign in" : "Create owner account");
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
(__VLS_ctx.setupComplete ? "Access is restricted to the owner." : "Set the only account that can access this app.");
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.handleSubmit) },
    ...{ class: "auth__form" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "email",
    placeholder: "Email",
    required: true,
});
(__VLS_ctx.form.email);
if (!__VLS_ctx.setupComplete) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.form.name),
        type: "text",
        placeholder: "Name (optional)",
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "password",
    placeholder: "Password",
    required: true,
});
(__VLS_ctx.form.password);
if (__VLS_ctx.otpRequired) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.form.otp),
        type: "text",
        inputmode: "numeric",
        placeholder: "One-time code",
        required: true,
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
    disabled: (__VLS_ctx.auth.isLoading),
});
(__VLS_ctx.setupComplete ? "Sign in" : "Create account");
if (__VLS_ctx.auth.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "error" },
    });
    (__VLS_ctx.friendlyError);
}
/** @type {__VLS_StyleScopedClasses['auth']} */ ;
/** @type {__VLS_StyleScopedClasses['auth__card']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['auth__form']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            auth: auth,
            setupComplete: setupComplete,
            otpRequired: otpRequired,
            form: form,
            handleSubmit: handleSubmit,
            friendlyError: friendlyError,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=LoginView.vue.js.map