<template>
  <section class="auth">
    <div class="auth__card">
      <h2>{{ setupComplete ? "Sign in" : "Create owner account" }}</h2>
      <p class="muted">
        {{ setupComplete ? "Access is restricted to the owner." : "Set the only account that can access this app." }}
      </p>

      <form class="auth__form" @submit.prevent="handleSubmit">
        <input v-model="form.email" type="email" placeholder="Email" required />
        <input
          v-if="!setupComplete"
          v-model="form.name"
          type="text"
          placeholder="Name (optional)"
        />
        <input v-model="form.password" type="password" placeholder="Password" required />
        <input
          v-if="otpRequired"
          v-model="form.otp"
          type="text"
          inputmode="numeric"
          placeholder="One-time code"
          required
        />
        <button type="submit" :disabled="auth.isLoading">
          {{ setupComplete ? "Sign in" : "Create account" }}
        </button>
      </form>

      <div v-if="auth.error" class="error">{{ friendlyError }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
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
  } else {
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
  if (auth.error === "otp_required") return "Enter your authenticator code to continue.";
  if (auth.error === "invalid_otp") return "Invalid code. Try again.";
  return auth.error;
});
</script>

<style scoped lang="scss">
.auth {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
}

.auth__card {
  width: min(420px, 100%);
  background: var(--surface);
  border-radius: 1.5rem;
  padding: 2rem;
  box-shadow: var(--shadow-soft);
  border: 1px solid rgba(31, 27, 22, 0.08);
}

.auth__card h2 {
  margin-block: 0;
}

.auth__form {
  display: grid;
  gap: 0.75rem;

  input {
    padding: 0.7rem 0.9rem;
    border-radius: 0.9rem;
    border: 1px solid rgba(15, 23, 42, 0.15);
    font: inherit;
  }

  button {
    border: none;
    border-radius: 999px;
    padding: 0.7rem 1rem;
    background: var(--accent);
    color: var(--surface);
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 10px 20px rgba(20, 90, 79, 0.2);
  }
}

.muted {
  color: var(--muted-text);
}

.error {
  padding: 0.6rem 0.8rem;
  border-radius: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  margin-top: 1rem;
}
</style>
