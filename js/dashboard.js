import { supabase } from './auth.js';

let currentUser = null;
let selectedService = null;

const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    currentUser = session.user;

    // Populate States
    ['a-agentState', 'a-stateRes'].forEach(id => {
        const sel = document.getElementById(id);
        if(sel) {
            sel.innerHTML = '<option value="">Select state</option>';
            STATES.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o); });
        }
    });

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) {
        document.getElementById('who').textContent = `Welcome, ${profile.full_name || profile.email}`;
        if (profile.role === 'admin' || profile.role === 'super_admin') {
            document.getElementById('nav-admin').style.display = 'inline-flex';
        }
    }

    loadServices();
    loadApplications();
});

async function loadServices() {
    const { data: services } = await supabase.from('services').select('*');
    const container = document.getElementById('svcs');
    if (!services) return;
    container.innerHTML = '';
    services.forEach(svc => {
        const btn = document.createElement('button');
        btn.innerHTML = `${svc.name} <small>₦${svc.price.toLocaleString()}</small>`;
        btn.onclick = () => {
            document.querySelectorAll('.svcs button').forEach(b => b.classList.remove('on'));
            btn.classList.add('on');
            selectedService = svc;
            document.getElementById('pay').style.display = 'block';
            document.getElementById('paybtn').textContent = `Pay ₦${svc.price.toLocaleString()} (demo)`;
        };
        container.appendChild(btn);
    });
}

document.getElementById('paybtn').onclick = async () => {
    if (!selectedService) return;
    const btn = document.getElementById('paybtn');
    btn.textContent = 'Processing...'; btn.disabled = true;

    const ref = 'EIS-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    await supabase.from('payments').insert([{ reference: ref, user_id: currentUser.id, service_name: selectedService.name, amount: selectedService.price, status: 'successful' }]);
    
    document.getElementById('m-pay').textContent = `Payment OK. Reference: ${ref}`;
    document.getElementById('m-pay').className = 'msg ok';
    document.getElementById('pay').style.display = 'none';
    document.getElementById('f-app').style.display = 'block';
    document.getElementById('a-email').value = currentUser.email;
    btn.disabled = false;
};

document.getElementById('f-app').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Submitting...'; btn.disabled = true;

    const formData = {
        kegow: document.getElementById('a-kegow').value,
        agentState: document.getElementById('a-agentState').value,
        bvn: document.getElementById('a-bvn').value,
        bankName: document.getElementById('a-bankName').value,
        accountNo: document.getElementById('a-accountNo').value,
        accountName: document.getElementById('a-accountName').value,
        firstName: document.getElementById('a-firstName').value,
        lastName: document.getElementById('a-lastName').value,
        email: document.getElementById('a-email').value,
        phone: document.getElementById('a-phone').value,
        address: document.getElementById('a-address').value,
        stateRes: document.getElementById('a-stateRes').value,
        dob: document.getElementById('a-dob').value,
    };

    const { error } = await supabase.from('applications').insert([{
        user_id: currentUser.id, service_name: selectedService.name, amount: selectedService.price, status: 'In review', form_data: formData
    }]);

    if (error) {
        document.getElementById('m-app').textContent = error.message;
        document.getElementById('m-app').className = 'msg err';
        btn.textContent = 'Submit application'; btn.disabled = false;
    } else {
        document.getElementById('m-app').textContent = 'Submitted successfully!';
        document.getElementById('m-app').className = 'msg ok';
        e.target.reset();
        document.getElementById('f-app').style.display = 'none';
        btn.textContent = 'Submit application'; btn.disabled = false;
        loadApplications();
    }
};

async function loadApplications() {
    const { data: apps } = await supabase.from('applications').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    const tbody = document.getElementById('mine');
    if (!apps || apps.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="padding:12px; text-align:center;">No applications yet.</td></tr>'; return; }
    tbody.innerHTML = '';
    apps.forEach(app => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="padding:12px; border-bottom:1px solid #eee;">${app.form_data.firstName}</td>
                        <td style="padding:12px; border-bottom:1px solid #eee;">${app.id.split('-')[0]}</td>
                        <td style="padding:12px; border-bottom:1px solid #eee;">${app.service_name}</td>
                        <td style="padding:12px; border-bottom:1px solid #eee; font-weight:bold; color:var(--blue);">${app.status}</td>`;
        tbody.appendChild(tr);
    });
}

document.getElementById('btn-logout').onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
};
