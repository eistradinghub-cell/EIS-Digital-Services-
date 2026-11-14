import { supabase } from './supabase.js';

/* =========================================
   EIS DIGITAL SERVICES
   AUTHENTICATION SYSTEM
========================================= */

const $ = (id) => document.getElementById(id);

const viewHome = $('view-home');
const viewLogin = $('view-login');
const viewSignup = $('view-signup');

const navAuth = $('nav-auth');
const navUser = $('nav-user');


/* =========================================
   PAGE VIEW MANAGEMENT
========================================= */

function showView(view) {

    [viewHome, viewLogin, viewSignup].forEach(element => {

        if (element) {
            element.style.display =
                element === view ? 'block' : 'none';
        }

    });

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}


/* =========================================
   NAVIGATION MANAGEMENT
========================================= */

function updateNavigation(session) {

    if (navAuth) {
        navAuth.style.display = session ? 'none' : 'flex';
    }

    if (navUser) {
        navUser.style.display = session ? 'flex' : 'none';
    }

}


/* =========================================
   MESSAGE MANAGEMENT
========================================= */

function showMessage(id, message, type = 'err') {

    const element = $(id);

    if (!element) return;

    element.textContent = message;
    element.className = `msg ${type}`;

}


function clearMessages() {

    [
        'login-error',
        'signup-error',
        'signup-success'
    ].forEach(id => {

        const element = $(id);

        if (element) {
            element.textContent = '';
        }

    });

}


/* =========================================
   BUTTON LOADING
========================================= */

function setLoading(button, loading, text) {

    if (!button) return;

    if (loading) {

        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.textContent = text;
        button.disabled = true;

    } else {

        button.textContent =
            button.dataset.originalText || text;

        button.disabled = false;

    }

}


/* =========================================
   INITIAL AUTHENTICATION
========================================= */

async function initializeAuth() {

    updateNavigation(null);

    try {

        const {
            data: { session },
            error
        } = await supabase.auth.getSession();

        if (error) throw error;

        updateNavigation(session);

        if (session) {

            console.log(
                'Authenticated user:',
                session.user.email
            );

        }

    } catch (error) {

        console.error(
            'Authentication initialization:',
            error
        );

        updateNavigation(null);

    }

}


/* =========================================
   AUTH STATE LISTENER
========================================= */

supabase.auth.onAuthStateChange((event, session) => {

    updateNavigation(session);

    if (event === 'SIGNED_OUT') {
        showView(viewHome);
    }

    if (event === 'SIGNED_IN') {

        window.location.replace('dashboard.html');

    }

});


/* =========================================
   SIGN UP
========================================= */

$('form-signup')?.addEventListener('submit', async event => {

    event.preventDefault();

    const button = event.target.querySelector(
        'button[type="submit"]'
    );

    clearMessages();

    const name = $('signup-name')?.value.trim();
    const email = $('signup-email')?.value.trim().toLowerCase();
    const phone = $('signup-phone')?.value.trim();
    const password = $('signup-password')?.value;

    if (!name || !email || !phone || !password) {

        showMessage(
            'signup-error',
            'Please complete all fields.'
        );

        return;
    }

    if (password.length < 8) {

        showMessage(
            'signup-error',
            'Password must contain at least 8 characters.'
        );

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

        if (!data.user) {
            throw new Error('Account creation failed.');
        }

        if (data.session) {

            showMessage(
                'signup-success',
                'Account created successfully!',
                'ok'
            );

            window.location.replace('dashboard.html');

        } else {

            showMessage(
                'signup-success',
                'Account created! Please check your email to verify your account.',
                'ok'
            );

            $('form-signup').reset();

        }

    } catch (error) {

        console.error('Signup Error:', error);

        showMessage(
            'signup-error',
            error.message || 'Unable to create account.'
        );

    } finally {

        setLoading(button, false, 'Create Account');

    }

});


/* =========================================
   LOGIN
========================================= */

$('form-login')?.addEventListener('submit', async event => {

    event.preventDefault();

    const button = event.target.querySelector(
        'button[type="submit"]'
    );

    clearMessages();

    const email = $('login-email')?.value.trim().toLowerCase();
    const password = $('login-password')?.value;

    if (!email || !password) {

        showMessage(
            'login-error',
            'Enter your email and password.'
        );

        return;
    }

    setLoading(button, true, 'Logging in...');

    try {

        const { data, error } =
            await supabase.auth.signInWithPassword({

                email,
                password

            });

        if (error) throw error;

        if (!data.session) {
            throw new Error('Login session could not be established.');
        }

        window.location.replace('dashboard.html');

    } catch (error) {

        console.error('Login Error:', error);

        showMessage(
            'login-error',
            error.message || 'Login failed. Please try again.'
        );

    } finally {

        setLoading(button, false, 'Log In');

    }

});


/* =========================================
   LOGOUT
========================================= */

$('btn-logout')?.addEventListener('click', async () => {

    const button = $('btn-logout');

    if (button) button.disabled = true;

    try {

        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace('index.html');

    } catch (error) {

        console.error('Logout Error:', error);

        alert('Logout failed: ' + error.message);

        if (button) button.disabled = false;

    }

});


/* =========================================
   START APPLICATION
========================================= */

initializeAuth();

console.log('EIS Authentication JavaScript Loaded');
