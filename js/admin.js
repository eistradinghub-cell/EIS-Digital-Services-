import { supabase } from './auth.js';

let currentUser = null;
let userProfile = null;

async function initAdmin() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = session.user;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    userProfile = profile;

    // Security Check: Kick out non-admins
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

        // Render List
        const container = document.getElementById('admin-apps-list');
        if (apps.length === 0) {
            container.innerHTML = '<p>No applications found.</p>';
            return;
        }

        container.innerHTML = '';
        apps.forEach(app => {
            const div = document.createElement('div');
            div.className = 'app-item';
            
            const customerName = app.profiles?.full_name || 'Unknown Customer';
            const customerEmail = app.profiles?.email || 'No email';

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <strong>${app.service_name}</strong> (₦${app.amount.toLocaleString()})<br>
                        <span style="font-size: 13px; color: var(--text-muted);">Customer: ${customerName} (${customerEmail})</span><br>
                        <span style="font-size: 12px; color: var(--primary); font-weight: 600;">Status: ${app.status}</span>
                    </div>
                    <div style="text-align: right;">
                        <select class="status-update" data-id="${app.id}" style="padding: 5px; border-radius: 5px; border: 1px solid #ccc;">
                            <option value="In review" ${app.status === 'In review' ? 'selected' : ''}>In review</option>
                            <option value="Completed" ${app.status === 'Completed' ? 'selected' : ''}>Completed</option>
                            <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                        </select>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

        // Add listeners to update status
        document.querySelectorAll('.status-update').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const newStatus = e.target.value;
                const appId = e.target.getAttribute('data-id');
                sel.disabled = true;
                
                const { error } = await supabase.from('applications').update({ status: newStatus }).eq('id', appId);
                
                if (error) {
                    alert('Failed to update: ' + error.message);
                } else {
                    loadAdminData(); // reload stats
                }
                sel.disabled = false;
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
