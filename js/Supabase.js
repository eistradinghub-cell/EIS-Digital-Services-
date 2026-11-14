import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* =========================================
   EIS DIGITAL SERVICES
   SUPABASE CONFIGURATION
========================================= */

const SUPABASE_URL = 'https://mbihyrbfeatcynspzune.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_alh5WL2JbOK6yW_5z5Fq4A_kJQHWt1-';

/* =========================================
   INITIALIZE SUPABASE CLIENT
========================================= */

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
            storage: window.localStorage,
            storageKey: 'eis-digital-services-auth'
        },

        global: {
            headers: {
                'X-Client-Info': 'eis-digital-services-web'
            }
        }
    }
);

/* =========================================
   AUTHENTICATION HELPERS
========================================= */

export async function getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Session Error:', error);
        return null;
    }

    return data.session;
}

export async function getCurrentUser() {
    const session = await getCurrentSession();

    if (!session) return null;

    const { data, error } = await supabase.auth.getUser();

    if (error) {
        console.error('User Error:', error);
        return null;
    }

    return data.user;
}

/* =========================================
   SIGN OUT
========================================= */

export async function logoutUser() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error('Logout Error:', error);
        throw error;
    }

    window.location.replace('index.html');
      }
