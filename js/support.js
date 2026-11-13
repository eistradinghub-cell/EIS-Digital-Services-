import { supabase } from './auth.js';

let currentUser = null;
let currentConversationId = null;

async function initChat() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    currentUser = session.user;

    // 1. Get or Create Conversation
    const { data: convs } = await supabase.from('chat_conversations').select('id').eq('customer_id', currentUser.id).single();
    
    if (convs) {
        currentConversationId = convs.id;
    } else {
        const { data: newConv, error } = await supabase.from('chat_conversations').insert([{ customer_id: currentUser.id }]).select('id').single();
        if (!error) currentConversationId = newConv.id;
    }

    if (currentConversationId) {
        loadMessages();
        setupRealtime();
    }
}

async function loadMessages() {
    const box = document.getElementById('chat-messages');
    const { data: msgs, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', currentConversationId)
        .order('created_at', { ascending: true });

    if (error) { box.innerHTML = `<p class="error-msg">Error: ${error.message}</p>`; return; }
    
    box.innerHTML = '';
    if (msgs.length === 0) {
        box.innerHTML = '<p style="text-align:center; color:#888; font-size:12px;">Start the conversation...</p>';
    } else {
        msgs.forEach(m => appendMessage(m));
    }
}

function appendMessage(m) {
    const box = document.getElementById('chat-messages');
    const isMine = m.sender_id === currentUser.id;
    const div = document.createElement('div');
    div.className = `msg-bubble ${isMine ? 'msg-mine' : 'msg-theirs'}`;
    
    const time = new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    div.innerHTML = `${m.content} <div class="msg-time">${time}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

document.getElementById('btn-send-msg').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentConversationId) return;

    input.value = '';
    const { error } = await supabase.from('chat_messages').insert([{
        conversation_id: currentConversationId,
        sender_id: currentUser.id,
        sender_role: 'customer',
        content: text
    }]);

    if (error) alert('Failed to send message: ' + error.message);
}

// Realtime Listener
function setupRealtime() {
    supabase.channel('chat-room')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${currentConversationId}` }, payload => {
            const newMsg = payload.new;
            if (newMsg.sender_id !== currentUser.id) {
                appendMessage(newMsg);
            }
        })
        .subscribe();
}

initChat();
