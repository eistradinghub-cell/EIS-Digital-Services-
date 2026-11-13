import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// AN HADA WANNAN DA PROJECT DINKA
const SUPABASE_URL = 'https://mbihyrbfeatcynspzune.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_alh5WL2JbOK6yW_5z5Fq4A_kJQHWt1-';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const viewHome = document.getElementById('view-home');
const viewLogin = document.getElementById('view-login');
const viewSignup = document.getElementById('view-signup');
const navAuth = document.getElementById('nav-auth');
const navUser = document.getElementById('nav-user');

function showView(v) { viewHome.style.display='none'; viewLogin.style.display='none'; viewSignup.style.display='none'; v.style.display='block'; }
document.getElementById('btn-show-login').addEventListener('click', () => showView(viewLogin));
document.getElementById('btn-show-signup').addEventListener('click', () => showView(viewSignup));

supabase.auth.onAuthStateChange((event, session) => {
    if (session) { navAuth.style.display = 'none'; navUser.style.display = 'flex'; }
    else { navAuth.style.display = 'flex'; navUser.style.display = 'none'; showView(viewHome); }
});

document.getElementById('form-signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]'); btn.textContent = 'Creating...'; btn.disabled = true;
    const errEl = document.getElementById('signup-error'); errEl.textContent = '';
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;

    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;

        if (authData.user) {
            const { error: profileError } = await supabase.from('profiles').insert([{ id: authData.user.id, email, full_name: name, phone, role: 'customer' }]);
            if (profileError) throw profileError;
        }
        document.getElementById('signup-success').textContent = 'Account created! Redirecting...';
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
    } catch (error) { errEl.textContent = error.message; } 
    finally { btn.textContent = 'Sign Up'; btn.disabled = false; }
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]'); btn.textContent = 'Logging in...'; btn.disabled = true;
    const errEl = document.getElementById('login-error'); errEl.textContent = '';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = 'dashboard.html';
    } catch (error) { errEl.textContent = error.message; } 
    finally { btn.textContent = 'Log In'; btn.disabled = false; }
});

document.getElementById('btn-logout').addEventListener('click', async () => { await supabase.auth.signOut(); window.location.reload(); });
