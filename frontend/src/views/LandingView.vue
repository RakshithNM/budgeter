<template>
  <section class="landing">
    <div class="landing__hero">
      <div>
        <p class="eyebrow">Personal finance, private by default</p>
        <h1>Budgeter</h1>
        <p class="lead">
          A private budgeting workspace built for one person. Track budgets, income, spends,
          and net worth without sharing access.
        </p>
        <div class="cta">
          <RouterLink to="/login" class="btn">Sign in</RouterLink>
          <span class="muted">Only authorized access is allowed.</span>
        </div>
      </div>
      <div class="landing__card">
        <h3>What this app does</h3>
        <ul>
          <li>Set monthly budgets and targets.</li>
          <li>Track spends with payee rules.</li>
          <li>See cashflow and net‑worth trends.</li>
        </ul>
      </div>
    </div>

    <div class="landing__footer">
      <span>Budgeter is private by design.</span>
    </div>
  </section>
</template>

<script setup lang="ts"></script>

<style scoped lang="scss">
.landing {
  min-height: 100vh;
  padding: 3rem clamp(1.5rem, 4vw, 4rem);
  display: grid;
  gap: 2rem;
}

.landing__hero {
  display: grid;
  gap: 2rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  align-items: center;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.75rem;
  color: var(--muted-text);
}

h1 {
  margin: 0.5rem 0;
  font-size: clamp(2.2rem, 5vw, 3.8rem);
}

.lead {
  font-size: 1.1rem;
  color: var(--muted-text);
  max-width: 36rem;
}

.cta {
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  background: var(--accent);
  color: var(--surface);
  text-decoration: none;
  font-weight: 600;
}

.landing__card {
  background: var(--surface);
  padding: 1.5rem;
  border-radius: 1.5rem;
  box-shadow: var(--shadow-soft);
}

.landing__card ul {
  margin: 0.8rem 0 0;
  padding-left: 1.2rem;
}

.landing__footer {
  color: var(--muted-text);
  font-size: 0.9rem;
}

.muted {
  color: var(--muted-text);
}
</style>
