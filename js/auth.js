import { supabase } from './supabase.js';

/* =========================================
   EIS DIGITAL SERVICES
   AUTHENTICATION SYSTEM
   6-DIGIT EMAIL OTP VERIFICATION
========================================= */

const $ = (id) => document.getElementById(id);

const viewHome = $('view-home');
const viewLogin = $('view-login');
const viewSignup = $('view-signup');

const navAuth = $('nav-auth');
const navUser = $('nav-user');

const VERIFICATION_PAGE =
    `${window.location.origin}/email-confirmed.html`;

let redirecting = false;

// Recovery links must never trigger the normal signed-in dashboard redirect.
const isPasswordRecoveryRoute =
    new URLSearchParams(window.location.search).get('mode') === 'recovery';

let passwordRecoveryVerified = false;

let pendingVerificationEmail =
    sessionStorage.getItem('eis-pending-verification-email') || '';

/* =========================================
   CREATE PROFESSIONAL EMAIL VERIFICATION
   SCREEN
========================================= */

function createVerificationScreen() {

    if ($('view-verify')) return;

    const style = document.createElement('style');

    style.textContent = `
        .eis-verify-card {
            width: 100%;
            max-width: 480px;
            margin: 35px auto 55px;
            padding: 38px 30px;
            background: #ffffff;
            border: 1px solid #e0e9f1;
            border-radius: 22px;
            box-shadow: 0 16px 45px rgba(20,45,78,.09);
            text-align: center;
        }

        .eis-verify-brand {
            color: #168477;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 2px;
            margin-bottom: 25px;
        }

        .eis-verify-icon {
            width: 76px;
            height: 76px;
            margin: 0 auto 22px;
            display: grid;
            place-items: center;
            border-radius: 22px;
            background: #eaf4f5;
            color: #168477;
            font-size: 34px;
        }

        .eis-verify-card h2 {
            margin: 0 0 12px;
            color: #142d4e;
            font-size: 27px;
            font-weight: 800;
        }

        .eis-verify-description {
            margin: 10px 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.75;
        }

        .eis-verify-email {
            margin: 17px 0;
            padding: 13px;
            border: 1px solid #dce8f2;
            border-radius: 11px;
            background: #f5f9fc;
            color: #142d4e;
            font-size: 14px;
            font-weight: 800;
            overflow-wrap: anywhere;
        }

        .eis-verify-button {
            width: 100%;
            min-height: 49px;
            margin-top: 13px;
            padding: 12px 15px;
            border: none;
            border-radius: 11px;
            background: #142d4e;
            color: #ffffff;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: .2s ease;
        }

        .eis-verify-button:hover {
            background: #168477;
        }

        .eis-verify-button:disabled {
            opacity: .6;
            cursor: wait;
        }

        .eis-verify-gmail {
            background: #168477;
            text-decoration: none;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .eis-verify-secondary {
            background: #edf3f8;
            color: #142d4e;
        }

        .eis-verify-secondary:hover {
            background: #e0eaf2;
        }

        .eis-verify-note {
            margin-top: 22px;
            color: #8793a2;
            font-size: 12px;
            line-height: 1.7;
        }

        .eis-verify-divider {
            height: 1px;
            margin: 23px 0;
            background: #e8edf2;
        }

        @media(max-width:520px) {
            .eis-verify-card {
                margin: 22px auto 40px;
                padding: 29px 19px;
            }

            .eis-verify-card h2 {
                font-size: 24px;
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

            <div class="eis-verify-brand">
                EIS DIGITAL SERVICES
            </div>

            <h2>Check Your Inbox</h2>

            <p class="eis-verify-description">
                We've sent a 6-digit verification code to:
            </p>

            <div
                class="eis-verify-email"
                id="verify-email-display">
            </div>

            <p class="eis-verify-description">
                Enter the 6-digit code from your email below
                to verify and activate your EIS account.
            </p>

            <form id="form-email-otp" style="margin-top:20px;">
                <label for="email-otp-input" style="display:block;text-align:left;color:#142d4e;font-size:13px;font-weight:700;margin-bottom:8px;">
                    6-DIGIT VERIFICATION CODE
                </label>
                <input
                    id="email-otp-input"
                    name="token"
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxlength="6"
                    minlength="6"
                    required
                    aria-label="Six digit email verification code"
                    placeholder="Enter 6-digit code"
                    style="width:100%;height:54px;padding:12px 15px;border:1px solid #cbd5e1;border-radius:11px;text-align:center;letter-spacing:9px;font-size:23px;font-weight:800;color:#142d4e;">
                <button
                    type="submit"
                    class="eis-verify-button"
                    id="btn-verify-otp">
                    Verify Email Address
                </button>
            </form>

            <a
                href="https://mail.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                class="eis-verify-button eis-verify-gmail">
                Open Email Inbox
            </a>

            <button
                type="button"
                class="eis-verify-button eis-verify-secondary"
                id="btn-resend-verification">
                Resend 6-Digit Code
            </button>

            <p
                id="verify-error"
                class="msg err"
                role="alert"
                aria-live="polite">
            </p>

            <p
                id="verify-success"
                class="msg ok"
                role="status"
                aria-live="polite">
            </p>

            <div class="eis-verify-divider"></div>

            <button
                type="button"
                class="eis-verify-button eis-verify-secondary"
                id="btn-change-verification-email">
                Back to Sign Up
            </button>

            <p class="eis-verify-note">
                Didn't receive the email?
                Check your Spam or Promotions folder.
                You can also request another verification email.
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

createVerificationScreen();

/* =========================================
   PASSWORD RECOVERY SCREEN
========================================= */

function createPasswordRecoveryScreen() {
    if ($('view-password-recovery')) return;

    const section = document.createElement('section');
    section.className = 'view wrap';
    section.id = 'view-password-recovery';
    section.style.cssText = 'display:none;padding-top:20px;';
    section.innerHTML = `
        <form class="card auth-card" id="form-password-recovery">
            <h2>Reset Your Password</h2>
            <p style="color:var(--mu);margin-top:5px;">
                Enter a new password for your EIS account.
            </p>
            <label for="recovery-new-password">New Password</label>
            <input type="password" id="recovery-new-password"
                   autocomplete="new-password" minlength="8"
                   placeholder="Enter your new password" required>
            <label for="recovery-confirm-password">Confirm New Password</label>
            <input type="password" id="recovery-confirm-password"
                   autocomplete="new-password" minlength="8"
                   placeholder="Confirm your new password" required>
            <button type="submit" class="btn btn-primary btn-block"
                    id="btn-save-new-password">Update Password</button>
            <p class="msg err" id="recovery-error" role="alert"
               aria-live="polite"></p>
        </form>`;
    (document.querySelector('main') || document.body).appendChild(section);
}

createPasswordRecoveryScreen();

/* =========================================
   FORGOT PASSWORD EMAIL SCREEN
========================================= */

function createForgotPasswordScreen() {
    if ($('view-forgot-password')) return;

    const section = document.createElement('section');
    section.className = 'view wrap';
    section.id = 'view-forgot-password';
    section.style.cssText = 'display:none;padding-top:20px;';
    section.innerHTML = `
        <form class="card auth-card" id="form-forgot-password">
            <h2>Forgot Password?</h2>
            <p style="color:var(--mu);margin-top:5px;line-height:1.6;">
                Enter the email address linked to your EIS account. We will send you a secure password reset link.
            </p>
            <label for="forgot-password-email">Email Address</label>
            <input type="email" id="forgot-password-email"
                   name="email" autocomplete="email"
                   placeholder="Enter your registered email" required>
            <button type="submit" class="btn btn-primary btn-block"
                    id="btn-send-reset-link">Send Reset Link</button>
            <p class="msg err" id="forgot-password-message"
               role="status" aria-live="polite"></p>
            <p style="text-align:center;margin-top:14px;font-size:14px;">
                <a href="#" id="link-back-to-login"
                   style="color:var(--blue);text-decoration:none;font-weight:600;">
                    Back to Login
                </a>
            </p>
        </form>`;
    (document.querySelector('main') || document.body).appendChild(section);
}

createForgotPasswordScreen();

/* =========================================
   PAGE VIEW MANAGEMENT
========================================= */

function showView(view) {

    [
        viewHome,
        viewLogin,
        viewSignup,
        $('view-verify'),
        $('view-password-recovery'),
        $('view-forgot-password')
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
   DASHBOARD REDIRECT
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
   SHOW EMAIL VERIFICATION SCREEN
========================================= */

function showVerificationView(email) {

    pendingVerificationEmail =
        email || pendingVerificationEmail;

    const display = $('verify-email-display');

    if (display) {
        display.textContent = pendingVerificationEmail;
    }

    clearMessages();

    showView($('view-verify'));
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
   INITIALIZE AUTH
========================================= */

async function initializeAuth() {

    updateNavigation(null);

    try {

        const { data, error } =
            await supabase.auth.getSession();

        if (error) throw error;

        const session = data.session;

        if (isPasswordRecoveryRoute) {
            updateNavigation(session);
            showView($('view-password-recovery'));
            return;
        }

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
   SAVE NEW PASSWORD
========================================= */

$('form-password-recovery')?.addEventListener('submit', async event => {
    event.preventDefault();

    const password = $('recovery-new-password')?.value || '';
    const confirm = $('recovery-confirm-password')?.value || '';

    if (!passwordRecoveryVerified) {
        const errorBox = $('recovery-error');
        if (errorBox) {
            errorBox.textContent =
                'This password reset link is not verified or has expired. Please request a new reset link from the login page.';
        }
        return;
    }
    const button = $('btn-save-new-password');
    const errorBox = $('recovery-error');

    if (errorBox) errorBox.textContent = '';
    if (password.length < 8) {
        if (errorBox) errorBox.textContent = 'Password must contain at least 8 characters.';
        return;
    }
    if (password !== confirm) {
        if (errorBox) errorBox.textContent = 'The passwords do not match.';
        return;
    }

    setLoading(button, true, 'Updating password...');
    try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;

        await supabase.auth.signOut();
        passwordRecoveryVerified = false;
        redirecting = false;
        window.history.replaceState({}, document.title, window.location.pathname);
        showView(viewLogin);
        showMessage('login-error', 'Your password has been updated successfully. You can now log in with your new password.', 'ok');
    } catch (error) {
        console.error('Password update error:', error);
        if (errorBox) errorBox.textContent = error.message || 'Could not update your password. Please request a new reset link.';
    } finally {
        setLoading(button, false, 'Update Password');
    }
});

/* =========================================
   AUTH STATE LISTENER
========================================= */

supabase.auth.onAuthStateChange((event, session) => {

    updateNavigation(session);

    if (event === 'PASSWORD_RECOVERY' && session) {
        passwordRecoveryVerified = true;
        redirecting = false;
        updateNavigation(session);
        showView($('view-password-recovery'));
        return;
    }

    if (event === 'SIGNED_IN' && session) {
        if (isPasswordRecoveryRoute) {
            updateNavigation(session);
            showView($('view-password-recovery'));
            return;
        }

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

    clearMessages();

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

    const firstName = $('signup-first-name')?.value
        .trim()
        .replace(/\s+/g, ' ');

    const middleName = $('signup-middle-name')?.value
        .trim()
        .replace(/\s+/g, ' ');

    const lastName = $('signup-last-name')?.value
        .trim()
        .replace(/\s+/g, ' ');

    const email = $('signup-email')?.value
        .trim()
        .toLowerCase();

    const phone = $('signup-phone')?.value.trim();

    const password = $('signup-password')?.value;

    const confirmPassword =
        $('signup-confirm-password')?.value;

    const name = [firstName, middleName, lastName]
        .filter(Boolean)
        .join(' ');

    if (
        !firstName ||
        !lastName ||
        !email ||
        !phone ||
        !password
    ) {

        showMessage(
            'signup-error',
            'Please enter your first name and last name, then complete all required fields.'
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

                    emailRedirectTo: VERIFICATION_PAGE,

                    data: {
                        name: name,
                        full_name: name,
                        first_name: firstName,
                        middle_name: middleName || null,
                        last_name: lastName,
                        phone: phone
                    }
                }
            });

        if (error) throw error;

        if (!data.user) {
            throw new Error('Account creation failed.');
        }

        // Supabase may return an empty identities array for an email
        // that is already registered when email confirmation is enabled.
        if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            throw new Error('This email address has already been used. Please log in or use another email.');
        }

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
            'Your account has been created. Please open your email and click the verification link to activate your account.',
            'ok'
        );

    } catch (error) {

        console.error('Signup error:', error);

        const errorText = [
            error?.message,
            error?.details,
            error?.hint
        ].filter(Boolean).join(' ').toLowerCase();

        const isDuplicate = error?.code === '23505' ||
            /duplicate key|already exists|already registered|unique constraint/.test(errorText);

        showMessage(
            'signup-error',
            isDuplicate
                ? 'This email address or phone number has already been used. Each one can only be registered once. Please log in or use different details.'
                : (error.message || 'Unable to create account.')
        );

    } finally {

        setLoading(button, false, 'Create Account');
    }
});

/* =========================================
   VERIFY 6-DIGIT SIGNUP OTP
========================================= */

$('form-email-otp')?.addEventListener('submit', async event => {
    event.preventDefault();

    const button = $('btn-verify-otp');
    const email = pendingVerificationEmail ||
        sessionStorage.getItem('eis-pending-verification-email') || '';
    const token = String($('email-otp-input')?.value || '').replace(/\D/g, '');

    clearMessages();

    if (!email) {
        showMessage('verify-error', 'Your pending email address was not found. Please sign up again.');
        return;
    }

    if (!/^\d{6}$/.test(token)) {
        showMessage('verify-error', 'Enter the complete 6-digit code sent to your email.');
        return;
    }

    setLoading(button, true, 'Verifying code...');

    try {
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'signup'
        });

        if (error) throw error;
        if (!data.user || !data.session) {
            throw new Error('Verification could not be completed. Please request a new code.');
        }

        sessionStorage.removeItem('eis-pending-verification-email');
        pendingVerificationEmail = '';
        goToDashboard();

    } catch (error) {
        console.error('Email OTP verification error:', error);
        showMessage('verify-error', error.message || 'The code is invalid or has expired. Request a new code and try again.');
    } finally {
        setLoading(button, false, 'Verify Email Address');
    }
});

/* =========================================
   RESEND VERIFICATION EMAIL
========================================= */

$('btn-resend-verification')?.addEventListener('click', async () => {

    const button = $('btn-resend-verification');

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

    setLoading(button, true, 'Sending email...');

    try {

        const { error } =
            await supabase.auth.resend({

                type: 'signup',

                email,

                options: {
                    emailRedirectTo: VERIFICATION_PAGE
                }
            });

        if (error) throw error;

        showMessage(
            'verify-success',
            'A new 6-digit verification code has been sent. Please check your inbox and spam folder.',
            'ok'
        );

    } catch (error) {

        console.error('Resend verification error:', error);

        showMessage(
            'verify-error',
            error.message || 'Unable to resend verification email.'
        );

    } finally {

        setLoading(button, false, 'Resend Verification Email');
    }
});

/* =========================================
   CHANGE EMAIL / BACK TO SIGNUP
========================================= */

$('btn-change-verification-email')?.addEventListener('click', () => {

    clearMessages();

    showView(viewSignup);
});

/* =========================================
   FORGOT PASSWORD REQUEST
========================================= */

$('link-forgot-password')?.addEventListener('click', event => {
    event.preventDefault();
    clearMessages();
    $('forgot-password-email').value = '';
    $('forgot-password-message').textContent = '';
    $('forgot-password-message').className = 'msg err';
    showView($('view-forgot-password'));
    $('forgot-password-email')?.focus();
});

$('link-back-to-login')?.addEventListener('click', event => {
    event.preventDefault();
    showView(viewLogin);
});

$('form-forgot-password')?.addEventListener('submit', async event => {
    event.preventDefault();

    const email = $('forgot-password-email')?.value.trim().toLowerCase();
    const button = $('btn-send-reset-link');
    const message = $('forgot-password-message');
    if (message) {
        message.textContent = '';
        message.className = 'msg err';
    }

    if (!email) {
        if (message) message.textContent = 'Please enter your email address.';
        return;
    }

    setLoading(button, true, 'Sending reset link...');
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/?mode=recovery'
        });
        if (error) throw error;

        if (message) {
            message.className = 'msg ok';
            message.textContent = 'If this email is registered, a password reset link has been sent. Please check your inbox and spam folder.';
        }
    } catch (error) {
        console.error('Password reset request error:', error);
        if (message) message.textContent = error.message || 'Could not send the reset link. Please try again.';
    } finally {
        setLoading(button, false, 'Send Reset Link');
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
