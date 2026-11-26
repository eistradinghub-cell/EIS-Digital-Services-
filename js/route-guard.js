import { supabase } from "./supabase.js";

/*
 * EIS protected customer routes.
 * Keep protected page markup hidden until Supabase confirms an active,
 * email-verified account. Database RLS remains the data-access boundary.
 */
export async function enforceProtectedRoute() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) throw error;

        const emailVerified = Boolean(
            user && (user.email_confirmed_at || user.confirmed_at)
        );

        if (!user || !emailVerified) {
            window.location.replace("./index.html");
            return false;
        }

        document.documentElement.classList.remove("eis-route-check");
        return true;
    } catch (error) {
        console.error("Protected route authentication check failed:", error);
        window.location.replace("./index.html");
        return false;
    }
}

await enforceProtectedRoute();
