import { createClient } from
'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* =========================================
   EIS DIGITAL SERVICES
   SUPABASE CONFIGURATION
========================================= */

const SUPABASE_URL =
'https://mbihyrbfeatcynspzune.supabase.co';

const SUPABASE_ANON_KEY =
'sb_publishable_alh5WL2JbOK6yW_5z5Fq4A_kJQHWt1-';


/* =========================================
   INITIALIZE SUPABASE
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
   GET CURRENT SESSION
========================================= */

export async function getCurrentSession() {

    const { data, error } =
        await supabase.auth.getSession();

    if (error) {
        console.error('Session Error:', error);
        return null;
    }

    return data.session;
}


/* =========================================
   GET CURRENT USER
========================================= */

export async function getCurrentUser() {

    const { data, error } =
        await supabase.auth.getUser();

    if (error) {
        console.error('User Error:', error);
        return null;
    }

    return data.user;
}


/* =========================================
   CHECK AUTHENTICATION
========================================= */

export async function isAuthenticated() {

    const session = await getCurrentSession();

    return Boolean(session);
}


/* =========================================
   LOGOUT
========================================= */

export async function logoutUser() {

    const { error } =
        await supabase.auth.signOut();

    if (error) {
        console.error('Logout Error:', error);
        throw error;
    }

    window.location.replace('./index.html');
}


/* =========================================
   AUTH STATE LISTENER
========================================= */

export function onAuthStateChange(callback) {

    const {
        data: { subscription }
    } = supabase.auth.onAuthStateChange(
        (event, session) => {

            if (typeof callback === 'function') {
                callback(event, session);
            }

        }
    );

    return subscription;
}


/* =========================================
   DEFAULT EXPORT
========================================= */

export default supabase;
