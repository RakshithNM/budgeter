import { defineStore } from "pinia";
import { api, type AuthUser } from "../lib/api";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as AuthUser | null,
    isLoading: false,
    error: "" as string | null,
    initialized: false
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user)
  },
  actions: {
    async init() {
      if (this.initialized) return;
      this.isLoading = true;
      try {
        this.user = await api.me();
      } catch {
        this.user = null;
      } finally {
        this.initialized = true;
        this.isLoading = false;
      }
    },
    async login(email: string, password: string, otp?: string) {
      this.isLoading = true;
      this.error = null;
      try {
        this.user = await api.login({ email, password, otp });
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Login failed";
        this.user = null;
      } finally {
        this.isLoading = false;
      }
    },
    async setup(email: string, password: string, name?: string) {
      this.isLoading = true;
      this.error = null;
      try {
        this.user = await api.setup({ email, password, name });
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Setup failed";
        this.user = null;
      } finally {
        this.isLoading = false;
      }
    },
    async logout() {
      this.isLoading = true;
      this.error = null;
      try {
        await api.logout();
        this.user = null;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Logout failed";
      } finally {
        this.isLoading = false;
      }
    }
  }
});
