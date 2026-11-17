import { supabase } from './supabase.js';

/* =========================================
   EIS DIGITAL SERVICES
   AUTHENTICATION SYSTEM
   EMAIL OTP VERIFICATION
========================================= */

const $ = (id) => document.getElementById(id);

const viewHome = $('view-home');
const viewLogin = $('view-login');
const viewSignup = $('view-signup');

const navAuth = $('nav-auth');
const navUser = $('nav-user');

let redirecting = false;

let pendingVerificationEmail =
    sessionStorage.getItem('eis-pending-verification-email') || '';

/* =========================================
   CREATE OTP VERIFICATION SCREEN
========================================= */

function createVerificationScreen() {

    if ($('view-verify')) return;

    const style = document.createElement('style');

    style.textContent = `
        .eis-verify-card {
            width: 100%;
            max-width: 470px;
            margin: 35px auto 55px;
            padding: 34px 30px;
            background: #ffffff;
            border: 1px solid #dce7f1;
            border-radius: 20px;
            box-shadow: 0 16px 45px rgba(20,45,78,.09);
            text-align: center;
        }

        .eis-verify-icon {
            width: 62px;
            height: 62px;
            margin: 0 auto 17px;
            display: grid;
            place-items: center;
            border-radius: 18px;
            background: #eaf3fb;
            color: #168477;
            font-size: 29px;
        }

        .eis-verify-brand {
            margin: 0 0 8px;
            color: #168477;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.8px;
        }

        .eis-verify-card h2 {
            margin: 0 0 12px;
            color: #142d4e;
            font-size: 27px;
            font-weight: 800;
        }

        .eis-verify-description {
            margin: 9px 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.65;
        }

        .eis-verify-email {
            margin: 8px 0 16px;
            color: #142d4e;
            font-size: 15px;
            font-weight: 800;
            overflow-wrap: anywhere;
        }

        #form-verify-email {
            margin-top: 22px;
            text-align: left;
        }

        #form-verify-email label {
            display: block;
            margin-bottom: 8px;
            color: #142d4e;
            font-size: 13px;
            font-weight: 700;
        }

        #verify-otp {
            box-sizing: border-box;
            width: 100%;
            min-height: 54px;
            margin-bottom: 16px;
            padding: 12px 15px;
            border: 1px solid #cbd8e5;
            border-radius: 11px;
            outline: none;
            background: #f8fbfe;
            color: #142d4e;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 7px;
            text-align: center;
        }

        #verify-otp:focus {
            border-color: #168477;
            box-shadow: 0 0 0 3px rgba(22,132,119,.12);
        }

        .eis-verify-button {
            width: 100%;
            min-height: 48px;
            margin-top: 10px;
            border: none;
            border-radius: 10px;
            background: #142d4e;
            color: #ffffff;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
        }

        .eis-verify-button:hover {
            background: #168477;
        }

        .eis-verify-button:disabled {
            opacity: .65;
            cursor: not-allowed;
        }

        .eis-verify-resend {
            background: #168477;
        }

        .eis-verify-note {
            margin: 20px 0 0;
            color: #7b8796;
            font-size: 12px;
            line-height: 1.6;
        }

        @media(max-width:520px) {
            .eis-verify-card {
                margin: 22px auto 40px;
                padding: 27px 19px;
            }
        }
    `;

    document.head.appendChild(style);

    const section = document.createElement('section');

    section.id = 'view-verify';
    section.className = 'view wrap';
    section.style.display = 'none';

    section.innerHTML = `
        <div class="eis-verify-card">

            <div class="eis-verify-icon">✉</div>

            <p class="eis-verify-brand">
                EIS DIGITAL SERVICES
            </p>

            <h2>Verify Your Email</h2>

            <p class="eis-verify-description">
                We have sent a verification code to:
            </p>

            <p
                class="eis-verify-email"
                id="verify-email-display">
            </p>

            <p class="eis-verify-description">
                Enter the code below to confirm your email
                address and activate your account.
            </p>

            <form id="form-verify-email">

                <label for="verify-otp">
                    Verification Code
                </label>

                <input
                    id="verify-otp"
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    pattern="[0-9]{6,8}"
                    maxlength="8"
                    placeholder="Enter your code"
                    required
                >

                <button
                    type="submit"
                    class="eis-verify-button">
                    Verify Email
                </button>

                <p
                    class="msg err"
                    id="verify-error"
                    role="alert"
                    aria-live="polite">
                </p>

                <p
                    class="msg ok"
                    id="verify-success"
                    role="status"
                    aria-live="polite">
                </p>

                <button
                    type="button"
                    class="eis-verify-button eis-verify-resend"
                    id="btn-resend-otp">
                    Resend Code
                </button>

            </form>

            <p class="eis-verify-note">
                Didn't receive the code?
                Check your spam folder or request a new code.
            </p>

        </div>
    `;

    const main = document.querySelector('main');

    if (main) {
        main.appendChild(section);
    } else {
        document.body.appendChild(section);
    }
}

/* =========================================
   CREATE OTP SCREEN BEFORE ITS EVENTS
========================================= */

createVerificationScreen();

/* =========================================
   PAGE VIEW MANAGEMENT
========================================= */

function showView(view) {

    [
        viewHome,
        viewLogin,
        viewSignup,
        $('view-verify')
    ].forEach(element => {

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
   NAVIGATION
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
   REDIRECT TO DASHBOARD
========================================= */

function goToDashboard() {

    if (redirecting) return;

    redirecting = true;

    window.location.replace('./dashboard.html');
}

/* =========================================
   MESSAGES
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
        'signup-success',
        'verify-error',
        'verify-success'
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

        button.dataset.originalText = button.textContent;
        button.textContent = text;
        button.disabled = true;

    } else {

        button.textContent =
            button.dataset.originalText || text;

        button.disabled = false;
    }
}

/* =========================================
   PASSWORD VISIBILITY
========================================= */

document.querySelectorAll('[data-password-toggle]').forEach(toggle => {

    toggle.addEventListener('click', () => {

        const input = $(toggle.dataset.passwordToggle);

        if (!input) return;

        const showing = input.type === 'password';

        input.type = showing ? 'text' : 'password';

        toggle.textContent = showing ? 'Hide' : 'Show';

        toggle.setAttribute(
            'aria-label',
            showing ? 'Hide password' : 'Show password'
        );

        toggle.setAttribute(
            'aria-pressed',
            String(showing)
        );

    });

});

/* =========================================
   LIVE PASSWORD CONFIRMATION
========================================= */

const signupPassword = $('signup-password');
const signupConfirmPassword = $('signup-confirm-password');
const passwordMatchMessage = $('signup-password-match');

function updatePasswordMatch() {

    if (
        !signupPassword ||
        !signupConfirmPassword ||
        !passwordMatchMessage
    ) {
        return;
    }

    if (!signupConfirmPassword.value) {

        passwordMatchMessage.textContent = '';

        passwordMatchMessage.className =
            'password-match-message';

        return;
    }

    const matches =
        signupPassword.value === signupConfirmPassword.value;

    passwordMatchMessage.textContent = matches
        ? 'Passwords match.'
        : 'Passwords do not match.';

    passwordMatchMessage.className =
        'password-match-message ' +
        (matches ? 'match' : 'no-match');
}

signupPassword?.addEventListener(
    'input',
    updatePasswordMatch
);

signupConfirmPassword?.addEventListener(
    'input',
    updatePasswordMatch
);

/* =========================================
   SHOW VERIFICATION SCREEN
========================================= */

function showVerificationView(email) {

    const display = $('verify-email-display');

    if (display) {
        display.textContent = email || pendingVerificationEmail;
    }

    clearMessages();

    showView($('view-verify'));
}

/* =========================================
   INITIALIZE AUTH
========================================= */

async function initializeAuth() {

    updateNavigation(null);

    try {

        const { data, error } =
            await supabase.auth.getSession();

        if (error) throw error;

        const session = data.session;

        if (session) {

            const user = session.user;

            const isVerified =
                !!(user.email_confirmed_at || user.confirmed_at);

            if (!isVerified) {

                await supabase.auth.signOut();

                updateNavigation(null);

                if (pendingVerificationEmail) {
                    showVerificationView(pendingVerificationEmail);
                } else {
                    showView(viewHome);
                }

                return;
            }

            updateNavigation(session);

            goToDashboard();

            return;
        }

        updateNavigation(null);

        if (pendingVerificationEmail) {
            showVerificationView(pendingVerificationEmail);
        } else {
            showView(viewHome);
        }

    } catch (error) {

        console.error('Auth initialization error:', error);

        updateNavigation(null);

        showView(viewHome);
    }
}

/* =========================================
   AUTH STATE LISTENER
========================================= */

supabase.auth.onAuthStateChange((event, session) => {

    updateNavigation(session);

    if (event === 'SIGNED_IN' && session) {

        const user = session.user;

        const isVerified =
            !!(user.email_confirmed_at || user.confirmed_at);

        if (isVerified) {
            goToDashboard();
        }
    }

    if (event === 'SIGNED_OUT') {

        redirecting = false;

        updateNavigation(null);

        if (pendingVerificationEmail) {
            showVerificationView(pendingVerificationEmail);
        } else {
            showView(viewHome);
        }
    }
});

/* =========================================
   NAVIGATION BUTTONS
========================================= */

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

    showView(viewLogin);
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

    const name = $('signup-name')?.value
        .trim()
        .replace(/\s+/g, ' ');

    const email = $('signup-email')?.value
        .trim()
        .toLowerCase();

    const phone = $('signup-phone')?.value.trim();

    const password = $('signup-password')?.value;

    const confirmPassword =
        $('signup-confirm-password')?.value;

    const nameParts = name
        ? name.split(' ').filter(Boolean)
        : [];

    const firstName = nameParts.shift() || '';

    const lastName = nameParts.join(' ');

    if (
        !firstName ||
        !lastName ||
        !email ||
        !phone ||
        !password
    ) {

        showMessage(
            'signup-error',
            'Please enter both your first name and last name, then complete all fields.'
        );

        return;
    }

    if (!confirmPassword) {

        showMessage(
            'signup-error',
            'Please confirm your password.'
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

    if (password !== confirmPassword) {

        showMessage(
            'signup-error',
            'The passwords do not match. Please check and try again.'
        );

        return;
    }

    setLoading(button, true, 'Creating account...');

    try {

        const { data, error } =
            await supabase.auth.signUp({

                email,

                password,

                options: {

                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`,
                        phone: phone
                    }
                }
            });

        if (error) throw error;

        if (!data.user) {
            throw new Error('Account creation failed.');
        }

        /*
         * Confirmation must be enabled in Supabase.
         * A session returned immediately means signup
         * may have bypassed the confirmation requirement.
         */

        if (data.session) {

            await supabase.auth.signOut();

            throw new Error(
                'Email confirmation is not enabled correctly. Please contact the website administrator.'
            );
        }

        pendingVerificationEmail = email;

        sessionStorage.setItem(
            'eis-pending-verification-email',
            email
        );

        event.target.reset();

        updatePasswordMatch();

        showVerificationView(email);

        showMessage(
            'verify-success',
            'Your account has been created. Enter the verification code sent to your email.',
            'ok'
        );

    } catch (error) {

        console.error('Signup error:', error);

        showMessage(
            'signup-error',
            error.message || 'Unable to create account.'
        );

    } finally {

        setLoading(button, false, 'Create Account');
    }
});

/* =========================================
   VERIFY EMAIL OTP
========================================= */

$('form-verify-email')?.addEventListener('submit', async event => {

    event.preventDefault();

    const button = event.target.querySelector(
        'button[type="submit"]'
    );

    const email =
        pendingVerificationEmail ||
        sessionStorage.getItem('eis-pending-verification-email') ||
        '';

    const token = $('verify-otp')?.value.trim();

    clearMessages();

    if (!email) {

        showMessage(
            'verify-error',
            'Verification email is missing. Please sign up again.'
        );

        return;
    }

    if (!token || !/^[0-9]{6,8}$/.test(token)) {

        showMessage(
            'verify-error',
            'Enter the verification code from your email.'
        );

        return;
    }

    setLoading(button, true, 'Verifying...');

    try {

        const { data, error } =
            await supabase.auth.verifyOtp({

                email: email,

                token: token,

                type: 'email'
            });

        if (error) throw error;

        if (!data.user || !(
            data.user.email_confirmed_at ||
            data.user.confirmed_at
        )) {

            throw new Error(
                'Email verification could not be confirmed. Please try again.'
            );
        }

        sessionStorage.removeItem(
            'eis-pending-verification-email'
        );

        pendingVerificationEmail = '';

        showMessage(
            'verify-success',
            'Email verified successfully. Opening your dashboard...',
            'ok'
        );

        if (data.session) {
            goToDashboard();
        } else {
            window.location.replace('./dashboard.html');
        }

    } catch (error) {

        console.error('Email verification error:', error);

        showMessage(
            'verify-error',
            error.message ||
            'The verification code is invalid or has expired.'
        );

    } finally {

        setLoading(button, false, 'Verify Email');
    }
});

/* =========================================
   RESEND OTP
========================================= */

$('btn-resend-otp')?.addEventListener('click', async () => {

    const button = $('btn-resend-otp');

    const email =
        pendingVerificationEmail ||
        sessionStorage.getItem('eis-pending-verification-email') ||
        '';

    clearMessages();

    if (!email) {

        showMessage(
            'verify-error',
            'No pending verification email was found. Please sign up again.'
        );

        return;
    }

    setLoading(button, true, 'Sending...');

    try {

        const { error } =
            await supabase.auth.resend({

                type: 'signup',

                email: email
            });

        if (error) throw error;

        showMessage(
            'verify-success',
            'A new verification code has been sent. Please check your inbox and spam folder.',
            'ok'
        );

    } catch (error) {

        console.error('Resend OTP error:', error);

        showMessage(
            'verify-error',
            error.message || 'Unable to resend verification code.'
        );

    } finally {

        setLoading(button, false, 'Resend Code');
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

    const email = $('login-email')?.value
        .trim()
        .toLowerCase();

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

        if (error) {

            if (error.code === 'email_not_confirmed') {

                pendingVerificationEmail = email;

                sessionStorage.setItem(
                    'eis-pending-verification-email',
                    email
                );

                showVerificationView(email);

                showMessage(
                    'verify-error',
                    'Please verify your email before logging in.'
                );

                return;
            }

            throw error;
        }

        if (!data.session || !data.user) {

            throw new Error(
                'Login session could not be established.'
            );
        }

        const isVerified =
            !!(data.user.email_confirmed_at || data.user.confirmed_at);

        if (!isVerified) {

            await supabase.auth.signOut();

            throw new Error(
                'Please verify your email before accessing your account.'
            );
        }

        sessionStorage.removeItem(
            'eis-pending-verification-email'
        );

        pendingVerificationEmail = '';

        goToDashboard();

    } catch (error) {

        console.error('Login error:', error);

        showMessage(
            'login-error',
            error.message || 'Login failed.'
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

        const { error } =
            await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace('./index.html');

    } catch (error) {

        console.error('Logout error:', error);

        alert('Logout failed: ' + error.message);

        if (button) button.disabled = false;
    }
});

/* =========================================
   START
========================================= */

initializeAuth(); 
