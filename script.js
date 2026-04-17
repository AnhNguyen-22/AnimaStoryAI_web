const WEBHOOK_URL = "https://n8n.n2nai.io/webhook/9df49bb2-f06b-4b3f-8253-25740cd189ba";
// Khi deploy thật thì đổi thành:
// const WEBHOOK_URL = "https://your-n8n-domain/webhook/generate-video";

document.addEventListener("DOMContentLoaded", () => {
  const promptInput = document.getElementById("promptInput");
  const generateBtn = document.getElementById("generateBtn");
  const statusText = document.getElementById("statusText");
  const resultBox = document.getElementById("resultBox");
  const historyVideo = document.querySelector("video[data-history-video]");
  const historyOverlay = document.querySelector("[data-video-overlay]");

  if (!promptInput || !generateBtn || !statusText) {
    console.error("Thiếu phần tử HTML cần thiết: promptInput, generateBtn hoặc statusText");
    return;
  }

  if (historyVideo && historyOverlay) {
    const togglePlay = async () => {
      try {
        if (historyVideo.paused) {
          await historyVideo.play();
        } else {
          historyVideo.pause();
        }
      } catch (e) {
        console.warn("Không thể phát video (trình duyệt chặn autoplay):", e);
      }
    };

    historyOverlay.addEventListener("click", togglePlay);
    historyVideo.addEventListener("click", togglePlay);
  }

  async function forceDownload(url, filename) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }

  document.querySelectorAll("[data-download-video]").forEach((el) => {
    el.addEventListener("click", async (e) => {
      const a = e.currentTarget;
      if (!(a instanceof HTMLAnchorElement)) return;

      // Ưu tiên hành vi download native. Chỉ dùng blob fallback khi đang chạy qua http(s).
      // Lưu ý: nếu mở file trực tiếp bằng file://, trình duyệt thường chặn fetch + download.
      if (window.location.protocol === "file:") {
        statusText.textContent =
          "System: Để tải xuống, hãy mở bằng server (vd: Live Server / http://localhost)";
        return; // để browser xử lý theo cách mặc định (thường sẽ mở video)
      }

      try {
        const href = a.getAttribute("href");
        if (!href) return;

        // Nếu browser hỗ trợ download attribute, không chặn click.
        // Nếu vẫn bị mở tab thay vì tải, click lần nữa sẽ dùng blob fallback (dưới).
        const supportsDownload = "download" in HTMLAnchorElement.prototype;
        if (supportsDownload && a.hasAttribute("download")) return;

        e.preventDefault();
        await forceDownload(href, a.getAttribute("download") || "video.mp4");
      } catch (err) {
        console.warn("Force download failed, fallback to normal link:", err);
        // fallback về mở link bình thường
        window.location.href = a.href;
      }
    });
  });

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function scrollChatToBottom() {
    try {
      window.requestAnimationFrame(() => {
        const scrollArea = document.querySelector(".flex-1.overflow-y-auto");
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
      });
    } catch (_) {
      // ignore
    }
  }

  function appendUserMessage(prompt) {
    if (!resultBox) return;

    const safe = escapeHtml(prompt);
    const wrapper = document.createElement("div");
    wrapper.className = "flex justify-end";
    wrapper.innerHTML = `
      <div class="max-w-[90%] md:max-w-[80%] bg-surface-container-highest border border-outline-variant/20 rounded-2xl px-5 py-4">
        <div class="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase mb-2">You</div>
        <div class="text-on-surface whitespace-pre-wrap leading-relaxed">${safe}</div>
      </div>
    `;
    resultBox.appendChild(wrapper);
    scrollChatToBottom();
  }

  function appendSystemLoading() {
    if (!resultBox) return null;

    const wrapper = document.createElement("div");
    wrapper.className = "flex justify-start";
    wrapper.innerHTML = `
      <div class="max-w-[90%] md:max-w-[80%] bg-surface-container-low border border-outline-variant/20 rounded-2xl px-5 py-4">
        <div class="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase mb-2">System</div>
        <div class="flex items-center gap-3 text-on-surface-variant">
          <span class="inline-flex h-4 w-4 rounded-full border-2 border-outline-variant/60 border-t-transparent animate-spin"></span>
          <span data-system-text>Đang xử lý...</span>
        </div>
      </div>
    `;

    resultBox.appendChild(wrapper);
    scrollChatToBottom();

    return wrapper.querySelector("[data-system-text]");
  }

  async function sendToN8n() {
    const prompt = promptInput.value.trim();

    if (!prompt) {
      statusText.textContent = "System: Please enter a prompt";
      if (resultBox) {
        resultBox.innerHTML = `
          <div class="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
            Vui lòng nhập prompt trước khi gửi.
          </div>
        `;
      }
      return;
    }

    try {
      generateBtn.disabled = true;
      statusText.textContent = "System: Sending request to n8n...";

      appendUserMessage(prompt);
      const systemTextEl = appendSystemLoading();

      if (resultBox) {
        // giữ lịch sử chat, không overwrite toàn bộ
      }

      const payload = {
        prompt,
        source: "web-ui",
        createdAt: new Date().toISOString()
      };

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      console.log("n8n response:", data);
      statusText.textContent = "System: Connected to n8n successfully";
      if (systemTextEl) systemTextEl.textContent = "Hoàn tất. Đã nhận phản hồi từ n8n.";

      if (resultBox) {
        const details = document.createElement("div");
        details.className = "flex justify-start";
        details.innerHTML = `
          <div class="max-w-[90%] md:max-w-[80%] bg-surface-container-high border border-outline-variant/20 rounded-2xl px-5 py-4">
            <div class="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase mb-2">n8n</div>
            <div class="text-sm text-on-surface-variant space-y-1">
              <div><span class="font-semibold text-on-surface">Message:</span> ${escapeHtml(data.message ?? "-")}</div>
            </div>
          </div>
        `;
        resultBox.appendChild(details);
        scrollChatToBottom();
      }
    } catch (error) {
      console.error("Lỗi khi gọi webhook:", error);
      statusText.textContent = "System: Failed to connect to n8n";

      if (resultBox) {
        const err = document.createElement("div");
        err.className = "flex justify-start";
        err.innerHTML = `
          <div class="max-w-[90%] md:max-w-[80%] bg-red-900/20 border border-red-500/30 rounded-2xl px-5 py-4">
            <div class="text-[10px] font-bold text-red-200 tracking-widest uppercase mb-2">System</div>
            <div class="text-red-100">Lỗi khi gọi webhook: ${escapeHtml(error?.message ?? "Unknown error")}</div>
          </div>
        `;
        resultBox.appendChild(err);
        scrollChatToBottom();
      }
    } finally {
      generateBtn.disabled = false;
    }
  }

  generateBtn.addEventListener("click", sendToN8n);

  promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendToN8n();
    }
  });
});