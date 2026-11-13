import { supabase } from './auth.js';

let currentUser = null;
let selectedService = null;

async function init() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { window.location.href = 'index.html'; return; }
        currentUser = session.user;

        const welcomeEl = document.getElementById('who');
        if (welcomeEl) welcomeEl.textContent = `Welcome, ${currentUser.email}`;

        loadServices();
        loadApps();
    } catch (err) {
        console.error(err);
    }
}

async function loadServices() {
    const container = document.getElementById('svcs');
    if (!container) return;
    try {
        const { data: services, error } = await supabase.from('services').select('*');
        if (error) throw error;

        container.innerHTML = '';
        if (!services || services.length === 0) {
            container.innerHTML = '<p style="padding: 10px; color: #666;">No services available at the moment.</p>';
            return;
        }

        services.forEach(svc => {
            const btn = document.createElement('button');
            btn.innerHTML = `${svc.name} <br><small>₦${svc.price.toLocaleString()}</small>`;
            btn.onclick = () => {
                document.querySelectorAll('.svcs button').forEach(b => b.classList.remove('on'));
                btn.classList.add('on');
                selectedService = svc;
                document.getElementById('pay').style.display = 'block';
                document.getElementById('paybtn').textContent = `Pay ₦${svc.price.toLocaleString()} (demo)`;
            };
            container.appendChild(btn);
        });
    } catch (err) {
        container.innerHTML = `<p style="color:red; padding:10px;">Failed to load services: ${err.message}</p>`;
    }
}

async function loadApps() {
    const tbody = document.getElementById('mine');
    if (!tbody) return;
    
    try {
        const { data: apps, error } = await supabase.from('applications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        if (error) throw error;

        if (!apps || apps.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="4" style="padding:12px; text-align:center;">No applications yet.</td></tr>'; 
            return; 
        }
        
        tbody.innerHTML = '';
        apps.forEach(app => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="padding:12px; border-bottom:1px solid #eee;">${app.form_data.firstName}</td>
                            <td style="padding:12px; border-bottom:1px solid #eee;">${app.id.split('-')[0]}</td>
                            <td style="padding:12px; border-bottom:1px solid #eee;">${app.service_name}</td>
                            <td style="padding:12px; border-bottom:1px solid #eee; font-weight:bold; color:var(--blue);">${app.status}</td>`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:red; padding:12px;">Error: ${err.message}</td></tr>`;
    }
}

// Biyan kudi da Submit form din suna nan kamar yadda suke
const payBtn = document.getElementById('paybtn');
if (payBtn) {
    payBtn.onclick = async () => {
        if (!selectedService) return;
        payBtn.textContent = 'Processing...'; payBtn.disabled = true;
        const ref = 'EIS-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const { error } = await supabase.from('payments').insert([{ reference: ref, user_id: currentUser.id, service_name: selectedService.name, amount: selectedService.price, status: 'successful' }]);
        if (!error) {
            document.getElementById('m-pay').textContent = `Payment OK. Reference: ${ref}`;
            document.getElementById('m-pay').className = 'msg ok';
            document.getElementById('pay').style.display = 'none';
            document.getElementById('f-app').style.display = 'block';
            document.getElementById('a-email').value = currentUser.email;
        }
        payBtn.disabled = false;
    };
}

const appForm = document.getElementById('f-app');
if (appForm) {
    appForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.textContent = 'Submitting...'; btn.disabled = true;
        const formData = {
            kegow: document.getElementById('a-kegow').value, agentState: document.getElementById('a-agentState').value,
            bvn: document.getElementById('a-bvn').value, bankName: document.getElementById('a-bankName').value,
            accountNo: document.getElementById('a-accountNo').value, accountName: document.getElementById('a-accountName').value,
            firstName: document.getElementById('a-firstName').value, lastName: document.getElementById('a-lastName').value,
            email: document.getElementById('a-email').value, phone: document.getElementById('a-phone').value,
            address: document.getElementById('a-address').value, stateRes: document.getElementById('a-stateRes').value, dob: document.getElementById('a-dob').value,
        };
        const { error } = await supabase.from('applications').insert([{ user_id: currentUser.id, service_name: selectedService.name, amount: selectedService.price, status: 'In review', form_data: formData }]);
        if (!error) {
            document.getElementById('m-app').textContent = 'Submitted successfully!';
            document.getElementById('m-app').className = 'msg ok';
            e.target.reset(); document.getElementById('f-app').style.display = 'none'; loadApps();
        } else {
            document.getElementById('m-app').textContent = error.message;
            document.getElementById('m-app').className = 'msg err';
        }
        btn.textContent = 'Submit application'; btn.disabled = false;
    };
}

const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) logoutBtn.onclick = async () => { await supabase.auth.signOut(); window.location.href = 'index.html'; };

init();
