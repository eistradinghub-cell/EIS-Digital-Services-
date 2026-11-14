/* =====================================================
   EIS DIGITAL SERVICES
   FILE 7: js/support.js
   Customer Support Chat System
===================================================== */

import { supabase } from "./supabase.js";

/* ===============================
   GLOBAL VARIABLES
================================ */

let currentUser = null;
let currentConversation = null;
let realtimeChannel = null;
let isSending = false;

/* ===============================
   TABLE NAMES
================================ */

const CHAT_TABLES = {
    conversations: "chat_conversations",
    messages: "chat_messages"
};

/* ===============================
   DOM HELPERS
================================ */

function getElement(id) {
    return document.getElementById(id);
}

function showMessage(message, type = "info") {
    const container =
        getElement("chat-notification") ||
        getElement("support-message") ||
        getElement("notification");

    if (!container) {
        console.log(message);
        return;
    }

    container.textContent = message;
    container.className = `notification ${type}`;
    container.hidden = false;

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        container.hidden = true;
    }, 5000);
}

/* ===============================
   AUTHENTICATION
================================ */

async function checkSupportSession() {
    try {
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error) throw error;

        if (!user) {
            window.location.href = "index.html";
            return false;
        }

        currentUser = user;

        return true;

    } catch (error) {
        console.error("Support authentication error:", error);

        window.location.href = "index.html";

        return false;
    }
}

/* ===============================
   CREATE OR GET CONVERSATION
================================ */

async function getConversation() {
    if (!currentUser) return null;

    try {
        const { data, error } = await supabase
            .from(CHAT_TABLES.conversations)
            .select("*")
            .eq("customer_id", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            currentConversation = data[0];
            return currentConversation;
        }

        const { data: newConversation, error: createError } =
            await supabase
                .from(CHAT_TABLES.conversations)
                .insert([{
                    customer_id: currentUser.id,
                    status: "open"
                }])
                .select()
                .single();

        if (createError) throw createError;

        currentConversation = newConversation;

        return currentConversation;

    } catch (error) {
        console.error("Conversation error:", error);

        showMessage(
            "Unable to open customer support conversation.",
            "error"
        );

        return null;
    }
}

/* ===============================
   DISPLAY MESSAGE
================================ */

function displayMessage(message) {
    const container =
        getElement("chat-messages") ||
        getElement("messages-container");

    if (!container || !message) return;

    const messageId = String(message.messageid || message.MessageID || message.id || "");

    if (
        messageId &&
        container.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)
    ) {
        return;
    }

    const wrapper = document.createElement("div");

    wrapper.className = "chat-message";

    if (
        String(message.sender_id || message.SenderID) ===
        String(currentUser?.id)
    ) {
        wrapper.classList.add("my-message");
    } else {
        wrapper.classList.add("other-message");
    }

    if (messageId) {
        wrapper.dataset.messageId = messageId;
    }

    const content = document.createElement("p");

    content.textContent =
        message.message_content ||
        message.MessageContent ||
        "";

    const timestamp = document.createElement("small");

    const rawDate =
        message.timestamp ||
        message.Timestamp ||
        message.created_at;

    timestamp.textContent = rawDate
        ? new Date(rawDate).toLocaleString("en-NG")
        : "";

    wrapper.append(content, timestamp);

    container.appendChild(wrapper);

    container.scrollTop = container.scrollHeight;
}

/* ===============================
   LOAD MESSAGES
================================ */

async function loadMessages() {
    if (!currentConversation) return [];

    const container =
        getElement("chat-messages") ||
        getElement("messages-container");

    try {
        const { data, error } = await supabase
            .from(CHAT_TABLES.messages)
            .select("*")
            .eq(
                "conversation_id",
                currentConversation.id ||
                currentConversation.conversationid ||
                currentConversation.ConversationID
            )
            .order("created_at", { ascending: true });

        if (error) throw error;

        if (container) {
            container.replaceChildren();

            if (!data || data.length === 0) {
                const empty = document.createElement("p");

                empty.textContent =
                    "No messages yet. Send a message to start chatting.";

                container.appendChild(empty);
            } else {
                data.forEach(displayMessage);
            }
        }

        return data || [];

    } catch (error) {
        console.error("Load messages error:", error);

        showMessage(
            "Unable to load chat messages.",
            "error"
        );

        return [];
    }
}

/* ===============================
   SEND MESSAGE
================================ */

async function sendMessage(event) {
    if (event) event.preventDefault();

    if (isSending) return;

    if (!currentUser || !currentConversation) {
        showMessage(
            "Chat is not ready. Please refresh the page.",
            "error"
        );

        return;
    }

    const input =
        getElement("chat-input") ||
        getElement("message-input");

    if (!input) {
        showMessage("Message input was not found.", "error");
        return;
    }

    const content = input.value.trim();

    if (!content) {
        showMessage("Please enter a message.", "error");
        return;
    }

    if (content.length > 5000) {
        showMessage(
            "Message is too long. Maximum is 5000 characters.",
            "error"
        );

        return;
    }

    const conversationId =
        currentConversation.id ||
        currentConversation.conversationid ||
        currentConversation.ConversationID;

    const sendButton =
        getElement("send-message") ||
        getElement("send-button");

    try {
        isSending = true;

        if (sendButton) {
            sendButton.disabled = true;
        }

        const messageData = {
            conversation_id: conversationId,
            customer_id: currentUser.id,
            sender_id: currentUser.id,
            sender_role: "customer",
            message_type: "text",
            message_content: content,
            timestamp: new Date().toISOString(),
            delivery_status: "sent",
            read_status: "unread"
        };

        const { data, error } = await supabase
            .from(CHAT_TABLES.messages)
            .insert([messageData])
            .select()
            .single();

        if (error) throw error;

        input.value = "";

        displayMessage(data);

    } catch (error) {
        console.error("Send message error:", error);

        showMessage(
            error.message || "Message could not be sent.",
            "error"
        );

    } finally {
        isSending = false;

        if (sendButton) {
            sendButton.disabled = false;
        }

        input.focus();
    }
}

/* ===============================
   REALTIME CHAT
================================ */

function subscribeToMessages() {
    if (!currentConversation) return;

    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    const conversationId =
        currentConversation.id ||
        currentConversation.conversationid ||
        currentConversation.ConversationID;

    realtimeChannel = supabase
        .channel(`support-chat-${conversationId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: CHAT_TABLES.messages,
                filter: `conversation_id=eq.${conversationId}`
            },
            payload => {
                displayMessage(payload.new);
            }
        )
        .subscribe(status => {
            console.log("Chat realtime status:", status);
        });
}

/* ===============================
   CLEANUP
================================ */

function cleanupChat() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
}

/* ===============================
   EVENT LISTENERS
================================ */

function initializeChatEvents() {
    const form =
        getElement("chat-form") ||
        getElement("message-form");

    if (form) {
        form.addEventListener("submit", sendMessage);
    }

    const sendButton =
        getElement("send-message") ||
        getElement("send-button");

    if (sendButton && !form) {
        sendButton.addEventListener("click", sendMessage);
    }

    const input =
        getElement("chat-input") ||
        getElement("message-input");

    if (input) {
        input.addEventListener("keydown", event => {
            if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.isComposing
            ) {
                event.preventDefault();
                sendMessage(event);
            }
        });
    }
}

/* ===============================
   INITIALIZE SUPPORT
================================ */

async function initializeSupport() {
    const authenticated = await checkSupportSession();

    if (!authenticated) return;

    initializeChatEvents();

    const conversation = await getConversation();

    if (!conversation) return;

    await loadMessages();

    subscribeToMessages();
}

/* ===============================
   AUTH STATE
================================ */

supabase.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
        cleanupChat();
        window.location.href = "index.html";
    }
});

/* ===============================
   START SUPPORT
================================ */

document.addEventListener("DOMContentLoaded", () => {
    initializeSupport();
});

window.addEventListener("beforeunload", cleanupChat);

/* ===============================
   GLOBAL FUNCTIONS
================================ */

window.EISSupport = {
    getConversation,
    loadMessages,
    sendMessage,
    subscribeToMessages,
    cleanupChat
};
