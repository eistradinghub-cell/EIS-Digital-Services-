import { supabase } from './supabase.js';

const $ = (id) => document.getElementById(id);

const viewHome = $('view-home');
const viewLogin = $('view-login');
const viewSignup = $('view-signup');

const navAuth = $('nav-auth');
const navUser = $('nav-user');

function showView(view) {
    [viewHome, viewLogin, viewSignup].forEach(element => {
        if (!element) return;

        element.hidden = element !== view;
        element.style.display = element === view ? 'block' : 'none';
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNavigation(session) {
    if (navAuth) {
        navAuth.style.display = session ? 'none' : 'flex';
    }

    if (navUser) {
        navUser.style.display = session ? 'flex' : 'none';
    }
}

function showMessage(id, message, type = 'err') {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.className = `msg ${type}`;
}

function clearMessages() {
    ['login-error', 'signup-error', 'signup-success'].forEach(id => {
        const element = $(id);
        if (element) element.textContent = '';
    });
}

function setLoading(button, loading, text) {
    if (!button) return;

    if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = text;
        button.disabled = true;
    } else {
        button.textContent = button.dataset.originalText || text;
        button.disabled = false;
    }
}

// INITIALIZE AUTH

async function initializeAuth() {
    try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        updateNavigation(data.session);

        if (data.session) {
            window.location.replace('dashboard.html');
            return;
        }

        showView(viewHome);

    } catch (error) {
        console.error('Auth initialization:', error);
        updateNavigation(null);
        showView(viewHome);
    }
}

// AUTH STATE

supabase.auth.onAuthStateChange((event, session) => {
    updateNavigation(session);

    if (event === 'SIGNED_OUT') {
        showView(viewHome);
    }
});

// NAVIGATION

$('btn-show-login')?.addEventListener('click', () => {
    clearMessages();
    showView(viewLogin);
});

$('btn-show-signup')?.addEventListener('click', () => {
    clearMessages();
    showView(viewSignup);
});

$('cta')?.addEventListener('click', () => {
    clearMessages();
    showView(viewSignup);
});

$('link-to-signup')?.addEventListener('click', event => {
    event.preventDefault();
    clearMessages();
    showView(viewSignup);
});

$('link-to-login')?.addEventListener('click', event => {
    event.preventDefault();
    clearMessages();
    showView(viewLogin);
});

// SIGN UP

$('form-signup')?.addEventListener('submit', async event => {
    event.preventDefault();

    const form = event.target;
    const button = form.querySelector('button[type="submit"]');

    clearMessages();

    const name = $('signup-name').value.trim();
    const email = $('signup-email').value.trim().toLowerCase();
    const phone = $('signup-phone').value.trim();
    const password = $('signup-password').value;

    if (!name || !email || !phone || !password) {
        showMessage('signup-error', 'Please complete all fields.');
        return;
    }

    if (password.length < 8) {
        showMessage('signup-error', 'Password must contain at least 8 characters.');
        return;
    }

    setLoading(button, true, 'Creating account...');

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    phone: phone
                }
            }
        });

        if (error) throw error;

        if (data.session) {
            window.location.replace('dashboard.html');
            return;
        }

        showMessage(
            'signup-success',
            'Account created. Please verify your email, then log in.',
            'ok'
        );

    } catch (error) {
        console.error('Signup error:', error);
        showMessage('signup-error', error.message || 'Signup failed.');
    } finally {
        setLoading(button, false, 'Create Account');
    }
});

// LOGIN

$('form-login')?.addEventListener('submit', async event => {
    event.preventDefault();

    const button = event.target.querySelector('button[type="submit"]');

    clearMessages();

    const email = $('login-email').value.trim().toLowerCase();
    const password = $('login-password').value;

    if (!email || !password) {
        showMessage('login-error', 'Enter your email and password.');
        return;
    }

    setLoading(button, true, 'Logging in...');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        if (!data.session) {
            throw new Error('Login session was not created.');
        }

        window.location.replace('dashboard.html');

    } catch (error) {
        console.error('Login error:', error);
        showMessage('login-error', error.message || 'Login failed.');
    } finally {
        setLoading(button, false, 'Log In');
    }
});

// LOGOUT

$('btn-logout')?.addEventListener('click', async () => {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace('index.html');

    } catch (error) {
        alert('Logout failed: ' + error.message);
    }
});

// START

initializeAuth();
