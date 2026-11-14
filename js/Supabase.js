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
   GET CURRENT SESSION
========================================= */

export async function getCurrentSession() {

    try {

        const { data, error } = await supabase.auth.getSession();

        if (error) {
            console.error('Session Error:', error);
            return null;
        }

        return data.session;

    } catch (error) {

        console.error('Unexpected Session Error:', error);

        return null;
    }
}


/* =========================================
   GET CURRENT USER
========================================= */

export async function getCurrentUser() {

    try {

        const { data, error } = await supabase.auth.getUser();

        if (error) {
            console.error('User Error:', error);
            return null;
        }

        return data.user;

    } catch (error) {

        console.error('Unexpected User Error:', error);

        return null;
    }
}


/* =========================================
   CHECK AUTHENTICATION
========================================= */

export async function isAuthenticated() {

    const session = await getCurrentSession();

    return Boolean(session);
}


/* =========================================
   SIGN OUT
========================================= */

export async function logoutUser() {

    try {

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Logout Error:', error);
            throw error;
        }

        window.location.replace('index.html');

    } catch (error) {

        console.error('Unexpected Logout Error:', error);

        throw error;
    }
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
   EXPORT DEFAULT CLIENT
========================================= */

export default supabase;
