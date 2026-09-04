

function initChatbot() {
  const openBtn = document.getElementById("openModal");
  const closeBtn = document.getElementById("closeModal");
  const modal = document.getElementById("modal");
  const chatGreeting = document.getElementById("chatGreeting");
  const closeGreeting = document.getElementById("closeGreeting");

  if (!modal || modal.dataset.chatbotInitialized) return;
  modal.dataset.chatbotInitialized = "true";

  function openChat() {
    if (!modal) return;
    modal.classList.add("open");
    if (openBtn) {
      openBtn.classList.add("active");
      openBtn.setAttribute("aria-expanded", "true");
    }
    if (chatGreeting) {
      chatGreeting.classList.add("hidden");
    }
  }

  function closeChat() {
    if (!modal) return;
    modal.classList.remove("open");
    if (openBtn) {
      openBtn.classList.remove("active");
      openBtn.setAttribute("aria-expanded", "false");
    }
    if (chatGreeting) {
      chatGreeting.classList.remove("hidden");
    }
  }

  // Toggle button click
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      if (modal.classList.contains("open")) {
        closeChat();
      } else {
        openChat();
      }
    });
  }

  // Header close button click
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeChat();
    });
  }

  // Click greeting textbox to open chatbot
  if (chatGreeting) {
    chatGreeting.addEventListener("click", (e) => {
      if (e.target.closest("#closeGreeting")) return;
      openChat();
    });
  }

  // Dismiss greeting textbox
  if (closeGreeting) {
    closeGreeting.addEventListener("click", (e) => {
      e.stopPropagation();
      if (chatGreeting) chatGreeting.classList.add("hidden");
    });
  }

  // Close on Escape key press
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("open")) {
      closeChat();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChatbot);
} else {
  initChatbot();
}
