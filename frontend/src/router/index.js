import { createRouter, createWebHistory } from "vue-router";
import OverviewView from "../views/OverviewView.vue";
import InsightsView from "../views/InsightsView.vue";
import LandingView from "../views/LandingView.vue";
import LoginView from "../views/LoginView.vue";
import AppLayout from "../layouts/AppLayout.vue";
import { useAuthStore } from "../store";
const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: "/",
            name: "landing",
            component: LandingView
        },
        {
            path: "/login",
            name: "login",
            component: LoginView
        },
        {
            path: "/app",
            component: AppLayout,
            meta: { requiresAuth: true },
            children: [
                {
                    path: "",
                    name: "overview",
                    component: OverviewView
                },
                {
                    path: "insights",
                    name: "insights",
                    component: InsightsView
                }
            ]
        }
    ]
});
router.beforeEach(async (to) => {
    const auth = useAuthStore();
    await auth.init();
    if (to.meta.requiresAuth && !auth.isAuthenticated) {
        return { name: "login" };
    }
    if (to.name === "login" && auth.isAuthenticated) {
        return { name: "overview" };
    }
    return true;
});
export default router;
//# sourceMappingURL=index.js.map