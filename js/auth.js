import { supabase } from './supabase.js';

if (document.getElementById('view-home')) {
    const viewHome = document.getElementById('view-home');
    const viewLogin = document.getElementById('view-login');
    const viewSignup = document.getElementById('view-signup');
    const navAuth = document.getElementById('nav-auth');
    const navUser = document.getElementById('nav-user');

    // 1. FARKO: Boye duk maɓallan da suka shafi User kafin a duba ko ya shiga
    if(navAuth) navAuth.style.display = 'none';
    if(navUser) navUser.style.display = 'none';

    function showView(v) { 
        if(viewHome) viewHome.style.display = (v === viewHome ? 'block' : 'none'); 
        if(viewLogin) viewLogin.style.display = (v === viewLogin ? 'block' : 'none'); 
        if(viewSignup) viewSignup.style.display = (v === viewSignup ? 'block' : 'none'); 
    }

    // 2. Duba ko akwai session a yanzu
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            if(navAuth) navAuth.style.display = 'none'; 
            if(navUser) navUser.style.display = 'flex'; 
            showView(viewHome);
        } else {
            if(navAuth) navAuth.style.display = 'flex'; 
            if(navUser) navUser.style.display = 'none'; 
            showView(viewHome);
        }
    });

    // 3. Sa ido kan canjin yanayi (Login/Logout)
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            if(navAuth) navAuth.style.display = 'none'; 
            if(navUser) navUser.style.display = 'flex'; 
            if (viewLogin && viewLogin.style.display === 'block' || viewSignup && viewSignup.style.display === 'block') {
                window.location.href = 'dashboard.html';
            }
        } else {
            if(navAuth) navAuth.style.display = 'flex'; 
            if(navUser) navUser.style.display = 'none'; 
            showView(viewHome);
        }
    });

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
}
