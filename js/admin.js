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
        document.getElementById('stat-products').textContent = '0'; // Placeholder

        const container = document.getElementById('admin-apps-list');
        if (apps.length === 0) {
            container.innerHTML = '<p>No applications found.</p>';
            return;
        }

        container.innerHTML = '';
        apps.forEach(app => {
            const div = document.createElement('div');
            div.className = 'app-card';
            
            const customerName = app.profiles?.full_name || 'Unknown';
            const customerEmail = app.profiles?.email || 'No email';
            const fd = app.form_data || {};
            
            let borderColor = 'var(--blue)';
            if (app.status === 'Completed') borderColor = '#12b894';
            if (app.status === 'Rejected') borderColor = 'var(--bad)';
            if (app.status === 'In review') borderColor = '#8a6a00';
            div.style.borderLeftColor = borderColor;

            div.innerHTML = `
                <div class="app-head">
                    <div class="app-title">${customerName} <span>${app.id.split('-')[0]}</span></div>
                    <div style="font-size: 12px; color: var(--mu);">${new Date(app.created_at).toLocaleDateString()}</div>
                </div>
                <div class="app-body">
                    <div class="detail-row"><span class="lbl">First Name</span><span class="val">${fd.firstName || '-'}</span></div>
                    <div class="detail-row"><span class="lbl">Last Name</span><span class="val">${fd.lastName || '-'}</span></div>
                    <div class="detail-row"><span class="lbl">Email</span><span class="val">${fd.email || customerEmail}</span></div>
                    <div class="detail-row"><span class="lbl">Phone</span><span class="val">${fd.phone || '-'}</span></div>
                    <div class="detail-row"><span class="lbl">BVN</span><span class="val">${fd.bvn || '-'}</span></div>
                    <div class="detail-row"><span class="lbl">Bank Name</span><span class="val">${fd.bankName || '-'}</span></div>
                    <div class="detail-row"><span class="lbl">Account No</span><span class="val">${fd.accountNo || '-'}</span></div>
                    <div class="detail-row"><span class="lbl">Service</span><span class="val">${app.service_name}</span></div>
                </div>
                <div class="app-foot">
                    <select class="status-select" data-id="${app.id}">
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
        document.getElementById('admin-apps-list').innerHTML = `<p class="error-msg">Error: ${err.message}</p>`;
    }
}

document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

initAdmin();
