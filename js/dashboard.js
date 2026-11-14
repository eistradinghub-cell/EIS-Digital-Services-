import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://mbihyrbfeatcynspzune.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_alh5WL2JbOK6yW_5z5Fq4A_kJQHWt1-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- LOGIC NA SHAFIN INDEX (Login/Signup) ---
if (document.getElementById('form-login')) {
    const viewHome = document.getElementById('view-home');
    const viewLogin = document.getElementById('view-login');
    const viewSignup = document.getElementById('view-signup');
    const navAuth = document.getElementById('nav-auth');
    const navUser = document.getElementById('nav-user');

    // Aikin nuna shafuka
    function showView(v) { 
        if(viewHome) viewHome.style.display='none'; 
        if(viewLogin) viewLogin.style.display='none'; 
        if(viewSignup) viewSignup.style.display='none'; 
        if(v) v.style.display='block'; 
    }

    // Maɓallan da ke canza shafi
    const btnShowLogin = document.getElementById('btn-show-login');
    const btnShowSignup = document.getElementById('btn-show-signup');
    const ctaBtn = document.getElementById('cta');
    const linkToSignup = document.getElementById('link-to-signup');
    const linkToLogin = document.getElementById('link-to-login');

    if(btnShowLogin) btnShowLogin.addEventListener('click', () => showView(viewLogin));
    if(btnShowSignup) btnShowSignup.addEventListener('click', () => showView(viewSignup));
    if(ctaBtn) ctaBtn.addEventListener('click', () => showView(viewSignup));
    if(linkToSignup) linkToSignup.addEventListener('click', (e) => { e.preventDefault(); showView(viewSignup); });
    if(linkToLogin) linkToLogin.addEventListener('click', (e) => { e.preventDefault(); showView(viewLogin); });

    // Wannan shine ke duba ko mutum ya shiga
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            // Idan ya shiga: Boye Login/Signup, nuna Dashboard/Logout
            if(navAuth) navAuth.style.display = 'none'; 
            if(navUser) navUser.style.display = 'flex'; 
            if (viewLogin && viewLogin.style.display === 'block' || viewSignup && viewSignup.style.display === 'block') {
                window.location.href = 'dashboard.html';
            }
        } else {
            // Idan bai shiga ba: Nuna Login/Signup, boye Dashboard/Logout
            if(navAuth) navAuth.style.display = 'flex'; 
            if(navUser) navUser.style.display = 'none'; 
            showView(viewHome);
        }
    });

    // Aikin yin Signup
    const signupForm = document.getElementById('form-signup');
    if(signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]'); 
            btn.textContent = 'Creating...'; btn.disabled = true;
            const errEl = document.getElementById('signup-error'); errEl.textContent = '';
            const succEl = document.getElementById('signup-success'); succEl.textContent = '';
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
                succEl.textContent = 'Account created! Redirecting to dashboard...';
                setTimeout(() => window.location.href = 'dashboard.html', 1500);
            } catch (error) { 
                errEl.textContent = error.message; 
            } finally { 
                btn.textContent = 'Sign Up'; btn.disabled = false; 
            }
        });
    }

    // Aikin yin Login
    const loginForm = document.getElementById('form-login');
    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]'); 
            btn.textContent = 'Logging in...'; btn.disabled = true;
            const errEl = document.getElementById('login-error'); errEl.textContent = '';
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            try {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                window.location.href = 'dashboard.html';
            } catch (error) { 
                errEl.textContent = error.message; 
            } finally { 
                btn.textContent = 'Log In'; btn.disabled = false; 
            }
        });
    }

    // Aikin Logout
    const logoutBtn = document.getElementById('btn-logout');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async () => { 
            await supabase.auth.signOut(); 
            window.location.reload(); 
        });
    }
}
