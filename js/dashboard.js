import { supabase } from './auth.js';

let currentUser = null;
let selectedService = null;

const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    currentUser = session.user;

    ['f-agentState', 'f-stateRes'].forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '<option value="">Select state</option>';
        STATES.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o); });
    });

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) {
        document.getElementById('welcome').textContent = `Welcome back, ${profile.full_name || profile.email}`;
        if (profile.role === 'admin' || profile.role === 'super_admin') {
            document.getElementById('nav-admin').style.display = 'inline-block';
        }
    }

    loadServices();
    loadApps();
}

async function loadServices() {
    const container = document.getElementById('services-container');
    try {
        const { data: services, error } = await supabase.from('services').select('*').order('price', { ascending: true });
        if (error) throw error;

        container.innerHTML = '';
        if (!services || services.length === 0) {
            container.innerHTML = '<p>No services available at the moment. Please check back later.</p>';
            return;
        }

        services.forEach(svc => {
            const div = document.createElement('div');
            div.className = 'service-card';
            div.innerHTML = `<h3>${svc.name}</h3><div class="price">₦${svc.price.toLocaleString()}</div>`;
            div.onclick = () => {
                document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
                div.classList.add('selected');
                selectedService = svc;
                document.getElementById('pay-section').style.display = 'block';
                document.getElementById('btn-pay').textContent = `Pay ₦${svc.price.toLocaleString()} (Demo)`;
            };
            container.appendChild(div);
        });
    } catch (err) {
        container.innerHTML = `<p style="color:red;">Failed to load services: ${err.message}</p>`;
    }
}

document.getElementById('btn-pay').onclick = async () => {
    if (!selectedService) return;
    const btn = document.getElementById('btn-pay');
    btn.textContent = 'Processing...'; btn.disabled = true;

    try {
        // Tabbatar da cewa profile din yana nan kafin a yi payment
        await supabase.from('profiles').upsert({
            id: currentUser.id,
            email: currentUser.email,
            role: 'customer'
        }, { onConflict: 'id' });

        const ref = 'EIS-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const { error: payError } = await supabase.from('payments').insert([{ 
            reference: ref, 
            user_id: currentUser.id, 
            service_name: selectedService.name, 
            amount: selectedService.price, 
            status: 'successful' 
        }]);

        if (payError) throw payError;

        document.getElementById('pay-section').style.display = 'none';
        document.getElementById('app-form').style.display = 'block';
        document.getElementById('f-email').value = currentUser.email;

    } catch (error) {
        alert('Payment failed: ' + error.message);
        btn.textContent = `Pay ₦${selectedService.price.toLocaleString()} (Demo)`;
        btn.disabled = false;
    }
};

document.getElementById('app-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const msgEl = document.getElementById('form-msg');
    btn.textContent = 'Submitting...'; btn.disabled = true;
    msgEl.textContent = '';

    const formData = {
        kegow: document.getElementById('f-kegow').value, agentState: document.getElementById('f-agentState').value,
        bvn: document.getElementById('f-bvn').value, bankName: document.getElementById('f-bankName').value,
        accountNo: document.getElementById('f-accountNo').value, accountName: document.getElementById('f-accountName').value,
        firstName: document.getElementById('f-firstName').value, lastName: document.getElementById('f-lastName').value,
        email: document.getElementById('f-email').value, phone: document.getElementById('f-phone').value,
        address: document.getElementById('f-address').value, stateRes: document.getElementById('f-stateRes').value, dob: document.getElementById('f-dob').value,
    };

    const { error } = await supabase.from('applications').insert([{
        user_id: currentUser.id, service_name: selectedService.name, amount: selectedService.price, status: 'In review', form_data: formData
    }]);

    if (error) {
        msgEl.textContent = error.message;
        msgEl.style.color = 'red';
        btn.textContent = 'Submit Application'; btn.disabled = false;
    } else {
        msgEl.textContent = 'Application submitted successfully!';
        msgEl.style.color = 'green';
        e.target.reset();
        document.getElementById('app-form').style.display = 'none';
        btn.textContent = 'Submit Application'; btn.disabled = false;
        loadApps();
    }
};

async function loadApps() {
    const tbody = document.getElementById('apps-list');
    const { data: apps } = await supabase.from('applications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    
    if (!apps || apps.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No applications yet.</td></tr>'; 
        return; 
    }
    
    tbody.innerHTML = '';
    apps.forEach(app => {
        const date = new Date(app.created_at).toLocaleDateString();
        let statusColor = app.status === 'Completed' ? 'var(--success)' : (app.status === 'Rejected' ? 'var(--danger)' : 'var(--primary)');
        tbody.innerHTML += `
            <tr>
                <td><strong>${app.service_name}</strong></td>
                <td>${app.id.split('-')[0]}</td>
                <td>${date}</td>
                <td><span style="color: ${statusColor}; font-weight: 600;">${app.status}</span></td>
            </tr>
        `;
    });
}

document.getElementById('btn-logout').onclick = async () => { await supabase.auth.signOut(); window.location.href = 'index.html'; };

init();
