import { supabase } from './auth.js';

let currentUser = null;

async function initAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    currentUser = session.user;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        alert('Access Denied. You are not an administrator.');
        window.location.href = 'dashboard.html';
        return;
    }

    loadAdminData();
}

async function loadAdminData() {
    try {
        const { data: apps, error } = await supabase
            .from('applications')
            .select('*, profiles(full_name, email)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        document.getElementById('stat-total').textContent = apps.length;
        document.getElementById('stat-review').textContent = apps.filter(a => a.status === 'In review').length;
        document.getElementById('stat-completed').textContent = apps.filter(a => a.status === 'Completed').length;

        const container = document.getElementById('admin-apps-list');
        if (apps.length === 0) {
            container.innerHTML = '<p>No applications found.</p>';
            return;
        }

        container.innerHTML = '';
        apps.forEach(app => {
            const fd = app.form_data || {};
            const customer = app.profiles?.full_name || 'Unknown';
            const email = app.profiles?.email || 'No email';
            
            let borderColor = 'var(--blue)';
            if (app.status === 'Completed') borderColor = 'var(--good)';
            if (app.status === 'Rejected') borderColor = 'var(--bad)';
            if (app.status === 'In review') borderColor = 'var(--warn)';

            const div = document.createElement('div');
            div.className = 'app-item';
            div.style.borderLeftColor = borderColor;
            div.innerHTML = `
                <div class="app-head">
                    <div style="font-weight: 800; font-family: 'Plus Jakarta Sans';">${customer} <span style="font-size:12px; background:#eee; padding:2px 6px; border-radius:10px; margin-left:8px;">${app.id.split('-')[0]}</span></div>
                    <div style="font-size: 12px; color: var(--mu);">${new Date(app.created_at).toLocaleDateString()}</div>
                </div>
                <div class="app-details">
                    <div><strong>Email:</strong> ${email}</div>
                    <div><strong>Phone:</strong> ${fd.phone || '-'}</div>
                    <div><strong>BVN:</strong> ${fd.bvn || '-'}</div>
                    <div><strong>Bank:</strong> ${fd.bankName || '-'} (${fd.accountNo || '-'})</div>
                    <div><strong>Service:</strong> ${app.service_name}</div>
                    <div><strong>Amount:</strong> ₦${app.amount.toLocaleString()}</div>
                </div>
                <div style="margin-top: 15px; border-top: 1px solid var(--ln); padding-top: 15px; display: flex; justify-content: flex-end;">
                    <select class="status-select" data-id="${app.id}" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--ln);">
                        <option value="In review" ${app.status === 'In review' ? 'selected' : ''}>In review</option>
                        <option value="In progress" ${app.status === 'In progress' ? 'selected' : ''}>In progress</option>
                        <option value="Completed" ${app.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </div>
            `;
            container.appendChild(div);
        });

        document.querySelectorAll('.status-select').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const newStatus = e.target.value;
                const appId = e.target.getAttribute('data-id');
                sel.disabled = true;
                
                const { error } = await supabase.from('applications').update({ status: newStatus }).eq('id', appId);
                
                if (error) {
                    alert('Failed to update: ' + error.message);
                    sel.disabled = false;
                } else {
                    loadAdminData(); 
                }
            });
        });

    } catch (err) {
        document.getElementById('admin-apps-list').innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    }
}

document.getElementById('nav-logout').onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
};

initAdmin();
