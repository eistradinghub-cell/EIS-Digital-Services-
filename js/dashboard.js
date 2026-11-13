import { supabase } from './auth.js';

let currentUser = null;
let userProfile = null;
let selectedService = null;

async function initDashboard() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = session.user;

    // Fetch Profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    userProfile = profile;
    
    if (profile) {
        document.getElementById('welcome-msg').textContent = `Welcome back, ${profile.full_name || profile.email}`;
        if (profile.role === 'admin' || profile.role === 'super_admin') {
            document.getElementById('nav-admin-link').style.display = 'block';
        }
    }

    loadServices();
    loadApplications();
}

async function loadServices() {
    const container = document.getElementById('services-list');
    try {
        const { data: services, error } = await supabase.from('services').select('*');
        if (error) throw error;
        
        if (!services || services.length === 0) {
            container.innerHTML = '<p>No services available.</p>';
            return;
        }

        container.innerHTML = '';
        services.forEach(svc => {
            const div = document.createElement('div');
            div.className = 'service-card';
            div.innerHTML = `<strong>${svc.name}</strong><br><span style="color: var(--primary); font-weight: 700;">₦${svc.price.toLocaleString()}</span>`;
            div.onclick = () => selectService(svc, div);
            container.appendChild(div);
        });
    } catch (err) {
        container.innerHTML = `<p class="error-msg">Error loading services: ${err.message}</p>`;
    }
}

function selectService(svc, div) {
    document.querySelectorAll('.service-card').forEach(el => el.classList.remove('selected'));
    div.classList.add('selected');
    selectedService = svc;
    document.getElementById('btn-pay').style.display = 'block';
    document.getElementById('btn-pay').textContent = `Pay ₦${svc.price.toLocaleString()} (Demo)`;
}

document.getElementById('btn-pay').addEventListener('click', async () => {
    if (!selectedService) return;
    const btn = document.getElementById('btn-pay');
    btn.textContent = 'Processing...'; btn.disabled = true;
    
    try {
        // Create a pending payment record
        const ref = 'EIS-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const { error } = await supabase.from('payments').insert([{
            reference: ref,
            user_id: currentUser.id,
            service_name: selectedService.name,
            amount: selectedService.price,
            status: 'pending'
        }]);
        
        if (error) throw error;
        
        // In a real app, you'd redirect to a payment gateway here.
        // For now, we simulate success after 2 seconds.
        setTimeout(async () => {
            await supabase.from('payments').update({ status: 'successful' }).eq('reference', ref);
            document.getElementById('payment-msg').textContent = `Payment successful! Ref: ${ref}`;
            document.getElementById('payment-msg').className = 'success-msg';
            loadApplications();
            btn.disabled = false;
            btn.textContent = `Pay ₦${selectedService.price.toLocaleString()} (Demo)`;
        }, 2000);

    } catch (err) {
        document.getElementById('payment-msg').textContent = err.message;
        document.getElementById('payment-msg').className = 'error-msg';
        btn.disabled = false;
        btn.textContent = `Pay ₦${selectedService.price.toLocaleString()} (Demo)`;
    }
});

async function loadApplications() {
    const container = document.getElementById('applications-list');
    const { data: apps, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p class="error-msg">Error: ${error.message}</p>`;
        return;
    }

    if (!apps || apps.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">No applications yet.</p>';
        return;
    }

    container.innerHTML = '';
    apps.forEach(app => {
        const div = document.createElement('div');
        div.style.cssText = 'border-bottom: 1px solid var(--border); padding: 10px 0;';
        let badgeClass = 'status-in-review';
        if (app.status === 'Completed') badgeClass = 'status-completed';
        if (app.status === 'Rejected') badgeClass = 'status-rejected';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${app.service_name}</strong><br>
                    <span style="font-size: 12px; color: var(--text-muted);">Ref: ${app.id.split('-')[0]}</span>
                </div>
                <span class="status-badge ${badgeClass}">${app.status}</span>
            </div>
            ${app.reason ? `<p style="font-size: 12px; color: var(--danger); margin-top: 5px;">Reason: ${app.reason}</p>` : ''}
        `;
        container.appendChild(div);
    });
}

document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

initDashboard();
