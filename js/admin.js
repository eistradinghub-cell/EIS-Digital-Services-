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

        // Update Stats
        document.getElementById('stat-total').textContent = apps.length;
        document.getElementById('stat-review').textContent = apps.filter(a => a.status === 'In review').length;
        document.getElementById('stat-completed').textContent = apps.filter(a => a.status === 'Completed').length;
        document.getElementById('stat-rejected').textContent = apps.filter(a => a.status === 'Rejected').length;

        const tbody = document.getElementById('admin-apps-list');
        if (apps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px;">No applications found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        apps.forEach(app => {
            const fd = app.form_data || {};
            const customer = app.profiles?.full_name || 'Unknown';
            const email = app.profiles?.email || 'No email';
            
            let badge = 'badge-review';
            if (app.status === 'Completed') badge = 'badge-completed';
            if (app.status === 'Rejected') badge = 'badge-rejected';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${customer}</strong><br>
                    <span style="font-size: 12px; color: #666;">${email}</span>
                </td>
                <td><strong>${app.service_name}</strong><br><span style="font-size: 12px;">₦${app.amount.toLocaleString()}</span></td>
                <td>
                    <div style="font-size: 12px; line-height: 1.6;">
                        <strong>BVN:</strong> ${fd.bvn || '-'}<br>
                        <strong>Bank:</strong> ${fd.bankName || '-'} (${fd.accountNo || '-'})
                    </div>
                </td>
                <td><span class="badge ${badge}">${app.status}</span></td>
                <td>
                    <select class="status-select" data-id="${app.id}">
                        <option value="In review" ${app.status === 'In review' ? 'selected' : ''}>In review</option>
                        <option value="In progress" ${app.status === 'In progress' ? 'selected' : ''}>In progress</option>
                        <option value="Completed" ${app.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
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
        document.getElementById('admin-apps-list').innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error: ${err.message}</td></tr>`;
    }
}

document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

initAdmin();
