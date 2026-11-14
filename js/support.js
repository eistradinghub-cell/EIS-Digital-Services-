import { supabase } from './supabase.js';

/* =========================================
   EIS DIGITAL SERVICES
   CUSTOMER SUPPORT CHAT
========================================= */

let currentUser = null;
let currentConversation = null;
let realtimeChannel = null;
let sendingMessage = false;


/* =========================================
   DOM ELEMENTS
========================================= */

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatForm = document.getElementById('chat-form');
const sendButton = document.getElementById('btn-send-msg');
const logoutButton = document.getElementById('logout-btn');
const noticeBox = document.getElementById('support-message');


/* =========================================
   NOTIFICATION
========================================= */

function showNotice(message, type = 'error') {

    if (!noticeBox) return;

    noticeBox.textContent = message;
    noticeBox.className = `chat-notice ${type}`;

    setTimeout(() => {
        noticeBox.textContent = '';
        noticeBox.className = 'chat-notice';
    }, 5000);
}


/* =========================================
   LOADING MESSAGE
========================================= */

function showLoading(message) {

    if (!chatMessages) return;

    chatMessages.replaceChildren();

    const paragraph = document.createElement('p');

    paragraph.textContent = message;
    paragraph.style.textAlign = 'center';
    paragraph.style.color = '#777';
    paragraph.style.fontSize = '13px';

    chatMessages.appendChild(paragraph);
}


/* =========================================
   FORMAT DATE
========================================= */

function formatTime(dateValue) {

    if (!dateValue) return '';

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString([], {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short'
    });
}


/* =========================================
   DISPLAY MESSAGE
========================================= */

function displayMessage(message) {

    if (!chatMessages || !message) return;

    // Prevent duplicate messages
    if (
        message.id &&
        chatMessages.querySelector(
            `[data-message-id="${CSS.escape(String(message.id))}"]`
        )
    ) {
        return;
    }

    const isMine = message.sender_id === currentUser?.id;

    const bubble = document.createElement('div');

    bubble.className = isMine
        ? 'msg-bubble msg-mine'
        : 'msg-bubble msg-theirs';

    if (message.id) {
        bubble.dataset.messageId = message.id;
    }

    const content = document.createElement('div');

    // Actual database column: content
    content.textContent = message.content || '';

    bubble.appendChild(content);

    const time = document.createElement('div');

    // Actual database column: created_at
    time.className = 'msg-time';
    time.textContent = formatTime(message.created_at);

    bubble.appendChild(time);

    chatMessages.appendChild(bubble);

    chatMessages.scrollTop = chatMessages.scrollHeight;
}


/* =========================================
   LOAD CURRENT USER
========================================= */

async function loadCurrentUser() {

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {

        console.error('Authentication Error:', error);

        window.location.replace('index.html');

        return null;
    }

    currentUser = data.user;

    return currentUser;
}


/* =========================================
   GET OR CREATE CONVERSATION
========================================= */

async function getConversation() {

    if (!currentUser) {
        throw new Error('User authentication required.');
    }

    // Actual database column: customer_id
    const { data: existingConversation, error: fetchError } =
        await supabase
            .from('chat_conversations')
            .select('*')
            .eq('customer_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

    if (fetchError) {
        console.error('Conversation Fetch Error:', fetchError);
        throw fetchError;
    }

    if (existingConversation) {

        currentConversation = existingConversation;

        return currentConversation;
    }

    // Create new conversation
    const { data: newConversation, error: createError } =
        await supabase
            .from('chat_conversations')
            .insert({
                customer_id: currentUser.id,
                status: 'open'
            })
            .select()
            .single();

    if (createError) {
        console.error('Conversation Creation Error:', createError);
        throw createError;
    }

    currentConversation = newConversation;

    return currentConversation;
}


/* =========================================
   LOAD CHAT MESSAGES
========================================= */

async function loadMessages() {

    if (!currentConversation) return;

    showLoading('Loading messages...');

    // Actual database column: conversation_id
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', currentConversation.id)
        .order('created_at', { ascending: true });

    if (error) {

        console.error('Messages Loading Error:', error);

        showNotice('Unable to load messages.');

        return;
    }

    chatMessages.replaceChildren();

    if (!data || data.length === 0) {

        const emptyMessage = document.createElement('p');

        emptyMessage.textContent =
            'No messages yet. Send us a message to start a conversation.';

        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#777';
        emptyMessage.style.fontSize = '13px';

        chatMessages.appendChild(emptyMessage);

        return;
    }

    data.forEach(displayMessage);

    chatMessages.scrollTop = chatMessages.scrollHeight;
}


/* =========================================
   SEND MESSAGE
========================================= */

async function sendMessage() {

    if (sendingMessage) return;

    const messageText = chatInput?.value.trim();

    if (!messageText) return;

    if (!currentUser || !currentConversation) {

        showNotice('Chat is not ready. Please refresh the page.');

        return;
    }

    sendingMessage = true;

    if (sendButton) {
        sendButton.disabled = true;
    }

    try {

        /*
         Actual database columns:

         conversation_id
         sender_id
         sender_role
         content
         attachment_url
         is_read
         created_at
        */

        const { data, error } = await supabase
            .from('chat_messages')
            .insert({
                conversation_id: currentConversation.id,
                sender_id: currentUser.id,
                sender_role: 'customer',
                content: messageText,
                is_read: false
            })
            .select()
            .single();

        if (error) {

            console.error('Send Message Error:', error);

            showNotice(
                'Message could not be sent. Please try again.'
            );

            return;
        }

        // Display immediately.
        // Realtime duplicate messages are prevented by ID.
        displayMessage(data);

        chatInput.value = '';

        /*
         Update conversation preview.
         This is separate from message sending so that
         a preview-update failure does not undo the message.
        */

        const { error: updateError } = await supabase
            .from('chat_conversations')
            .update({
                last_message: messageText,
                last_message_at: data.created_at
            })
            .eq('id', currentConversation.id);

        if (updateError) {
            console.warn(
                'Conversation Preview Update Error:',
                updateError
            );
        }

    } catch (error) {

        console.error('Unexpected Send Error:', error);

        showNotice('An unexpected error occurred.');

    } finally {

        sendingMessage = false;

        if (sendButton) {
            sendButton.disabled = false;
        }

        chatInput?.focus();
    }
}


/* =========================================
   REALTIME CHAT
========================================= */

function subscribeToMessages() {

    if (!currentConversation) return;

    // Remove previous subscription
    if (realtimeChannel) {

        supabase.removeChannel(realtimeChannel);

        realtimeChannel = null;
    }

    realtimeChannel = supabase
        .channel(
            `eis-support-${currentConversation.id}`
        )
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `conversation_id=eq.${currentConversation.id}`
            },
            (payload) => {

                displayMessage(payload.new);

            }
        )
        .subscribe((status) => {

            console.log('Chat Realtime Status:', status);

            if (status === 'SUBSCRIBED') {

                console.log('EIS Support Realtime Connected');

            }

            if (status === 'CHANNEL_ERROR') {

                console.error('Realtime Channel Error');

                showNotice(
                    'Live connection interrupted. Try refreshing.',
                    'error'
                );
            }

        });
}


/* =========================================
   LOGOUT
========================================= */

async function logout() {

    try {

        if (realtimeChannel) {

            await supabase.removeChannel(realtimeChannel);

            realtimeChannel = null;
        }

        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace('index.html');

    } catch (error) {

        console.error('Logout Error:', error);

        showNotice('Unable to log out. Please try again.');
    }
}


/* =========================================
   EVENT LISTENERS
========================================= */

function setupEventListeners() {

    if (chatForm) {

        chatForm.addEventListener('submit', (event) => {

            event.preventDefault();

            sendMessage();

        });

    } else if (sendButton) {

        sendButton.addEventListener('click', sendMessage);

    }

    if (logoutButton) {

        logoutButton.addEventListener('click', logout);

    }

}


/* =========================================
   INITIALIZE SUPPORT
========================================= */

async function initializeSupport() {

    try {

        showLoading('Connecting to support...');

        const user = await loadCurrentUser();

        if (!user) return;

        await getConversation();

        await loadMessages();

        subscribeToMessages();

        console.log('EIS Support Initialized Successfully');

    } catch (error) {

        console.error('Support Initialization Error:', error);

        showLoading(
            'Unable to connect to support. Please refresh the page.'
        );

        showNotice(
            'Support connection failed. Please try again.'
        );
    }
}


/* =========================================
   CLEANUP
========================================= */

window.addEventListener('beforeunload', () => {

    if (realtimeChannel) {

        supabase.removeChannel(realtimeChannel);

        realtimeChannel = null;
    }

});


/* =========================================
   START APPLICATION
========================================= */

setupEventListeners();

initializeSupport();


/* =========================================
   PUBLIC SUPPORT API
========================================= */

window.EISSupport = {
    initializeSupport,
    loadMessages,
    sendMessage,
    logout
};
