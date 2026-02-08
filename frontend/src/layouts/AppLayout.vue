<template>
  <div class="app">
    <header class="app__header">
      <div class="brand">
        <span class="brand__logo">B</span>
        <div>
          <h1>Budgeter</h1>
          <p>Track income, plan expenses, and stay ahead.</p>
        </div>
      </div>
      <nav class="nav">
        <RouterLink to="/app" exact-active-class="router-link-active">Overview</RouterLink>
        <RouterLink to="/app/insights">Insights</RouterLink>
        <button class="ghost" type="button" @click="handleLogout">Logout</button>
      </nav>
    </header>

    <main class="app__main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "../store";

const auth = useAuthStore();
const router = useRouter();

const handleLogout = async () => {
  await auth.logout();
  await router.replace("/login");
};
</script>

<style scoped lang="scss">
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2.5rem clamp(1.5rem, 4vw, 4rem) 3rem;
}

.app__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 1rem;

  h1 {
    margin: 0;
    font-size: clamp(1.5rem, 3vw, 2.4rem);
  }

  p {
    margin: 0.25rem 0 0;
    color: var(--muted-text);
  }
}

.brand__logo {
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  display: grid;
  place-items: center;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--surface);
  background: linear-gradient(130deg, var(--accent), var(--accent-strong));
}

.nav {
  display: flex;
  gap: 1rem;
  font-weight: 600;
  align-items: center;

  a {
    text-decoration: none;
    color: var(--text);
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    transition: all 0.2s ease;
  }

  a.router-link-active {
    background: var(--surface);
    box-shadow: var(--shadow-soft);
  }
}

.app__main {
  flex: 1;
  display: grid;
  gap: 2rem;
}

.ghost {
  border: none;
  background: transparent;
  color: var(--muted-text);
  cursor: pointer;
  font-size: 0.95rem;
}
</style>
