// ==UserScript==
// @name         GitHub Clone with Sourcetree
// @name:zh-CN   GitHub 使用 Sourcetree 克隆
// @namespace    https://github.com/cooaer/Tampermonkey-scripts
// @version      2.0
// @description  Adds an "Open with Sourcetree" button to the GitHub "Code" dropdown menu, allowing you to clone repositories directly into the Sourcetree application.
// @description:zh-CN 在 GitHub 的“Code”下拉菜单中添加一个“Open with Sourcetree”按钮，允许您直接将仓库克隆到 Sourcetree 应用程序中。
// @author       cooaer
// @match        https://github.com/*
// @icon         https://sourcetreeapp.com/favicon.ico
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/cooaer/Tampermonkey-scripts
// @supportURL   https://github.com/cooaer/Tampermonkey-scripts/issues
// @updateURL    https://github.com/cooaer/Tampermonkey-scripts/raw/master/github-clone-sourcetree.user.js
// @downloadURL  https://github.com/cooaer/Tampermonkey-scripts/raw/master/github-clone-sourcetree.user.js
// ==/UserScript==

(function () {
  "use strict";

  const sourcetreeButtonId = "open-with-sourcetree-btn";
  const DEBUG = true;

  function log(...args) {
    if (DEBUG) console.log("[GitHub Sourcetree]", ...args);
  }

  const sourcetreeIconSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="16" height="16" fill="currentColor">
            <path d="M64 .73C29.114.73.73 29.113.73 64S29.114 127.27 64 127.27c34.888 0 63.27-28.384 63.27-63.27S98.887.73 64 .73zm3.335 120.17v-10.988l27.44-13.9a1.955 1.955 0 001.073-1.747v-6.29a5.98 5.98 0 003.99-6.258 5.978 5.978 0 10-11.892 1.225 5.97 5.97 0 003.99 5.03v5.09l-24.6 12.46v-10.22l10.843-5.017a1.957 1.957 0 001.135-1.773l.02-17.026 20.07-11.276c.617-.346 1-1 1-1.706V53.76a5.974 5.974 0 00-2.57-11.59 5.975 5.975 0 00-1.344 11.59v3.606l-20.07 11.27c-.617.35-1 1-1 1.706l-.02 16.92-8.068 3.73V54.2l16.884-8.257a1.95 1.95 0 001.097-1.755v-6.29a5.978 5.978 0 003.99-6.26 5.976 5.976 0 00-6.56-5.33 5.975 5.975 0 00-5.332 6.56 5.964 5.964 0 003.99 5.027v5.07l-14.068 6.877V28.598a5.977 5.977 0 10-7.902-5.03 5.97 5.97 0 003.988 5.028V63.24l-9.943-5.224V42.28a1.95 1.95 0 00-.767-1.552l-6.802-5.21a5.978 5.978 0 10-2.61 2.928l6.265 4.802V59.2c0 .728.404 1.395 1.048 1.733l12.81 6.73v12.724l-21.37-9.884.292-7.742a1.956 1.956 0 00-1.063-1.815l-9.797-5.025c.147-.63.2-1.292.13-1.97a5.978 5.978 0 00-11.892 1.227 5.977 5.977 0 006.56 5.33 5.91 5.91 0 003.1-1.268l9.004 4.616-.295 7.8c-.03.79.417 1.52 1.133 1.85L63.42 84.7v9.084a1.98 1.98 0 000 .516v26.693a57.53 57.53 0 01-6.093-.387V97.66c0-.766-.445-1.46-1.14-1.778l-15.182-6.987a5.974 5.974 0 00-6.563-6.527 5.976 5.976 0 104.924 10.08l14.047 6.463v21.092C27.022 115.028 6.992 91.815 6.992 64c0-31.434 25.574-57.01 57.01-57.01 31.433 0 57.006 25.576 57.006 57.01 0 30.315-23.787 55.17-53.674 56.902z"/>
        </svg>
    `;

  function querySelectorAllDeep(selector, root = document) {
    let nodes = Array.from(root.querySelectorAll(selector));
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      null,
      false,
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.shadowRoot) {
        nodes = nodes.concat(querySelectorAllDeep(selector, node.shadowRoot));
      }
    }
    return nodes;
  }

  function findZipButton() {
    const zipSelectors = [
      'a[href$=".zip"]',
      'a[data-open-app="link"]',
      '.SelectMenu-item[href*="zip"]',
    ];
    for (const selector of zipSelectors) {
      const elements = querySelectorAllDeep(selector);
      const el = elements.find((a) =>
        a.textContent.toLowerCase().includes("zip"),
      );
      if (el) {
        return {
          anchor: el,
          container:
            el.closest("li") ||
            el.closest(".SelectMenu-item") ||
            el.closest('[role="menuitem"]') ||
            el.parentElement,
        };
      }
    }
    return null;
  }

  function getActiveTab() {
    const activeTabs = querySelectorAllDeep(
      'button[role="tab"][aria-selected="true"], a[role="tab"][aria-selected="true"]',
    );
    // Filter for specific sub-tabs
    const subTabs = ["HTTPS", "SSH", "GitHub CLI"];
    for (const tab of activeTabs) {
      const text = tab.textContent.trim();
      if (subTabs.some((t) => text.toUpperCase().includes(t.toUpperCase()))) {
        return text;
      }
    }
    return null;
  }

  function getCloneData() {
    const inputs = querySelectorAllDeep(
      "input.js-git-clone-help-field, input[data-autoselect], #empty-setup-clone-url",
    );
    const visibleInput = inputs.find(
      (i) => i.offsetWidth > 0 || i.offsetHeight > 0,
    );

    if (visibleInput && visibleInput.value) {
      const val = visibleInput.value.trim();
      return {
        url: val,
        isCli: val.startsWith("gh repo clone"),
      };
    }
    return null;
  }

  function addSourcetreeButton() {
    const zipTarget = findZipButton();
    if (!zipTarget) return;

    const cloneData = getCloneData();
    const activeTabText = getActiveTab();

    // LOGIC:
    // 1. If tab is "GitHub CLI" -> Hide
    // 2. If input starts with "gh repo clone" -> Hide
    // 3. If tab is "HTTPS" or "SSH" -> Show
    // 4. If tab is "Codespaces" (often no sub-tab) -> Hide

    let shouldShow = true;
    if (cloneData && cloneData.isCli) shouldShow = false;
    if (activeTabText) {
      const upper = activeTabText.toUpperCase();
      if (upper.includes("CLI")) shouldShow = false;
      if (upper.includes("CODESPACE")) shouldShow = false;
      // Explicitly allow HTTPS/SSH
      if (upper.includes("HTTPS") || upper.includes("SSH")) shouldShow = true;
    }

    let sourcetreeBtn = document.getElementById(sourcetreeButtonId);

    if (!shouldShow) {
      if (sourcetreeBtn) {
        const container =
          sourcetreeBtn.closest("li") ||
          sourcetreeBtn.closest(".SelectMenu-item") ||
          sourcetreeBtn.closest('[role="menuitem"]') ||
          sourcetreeBtn.parentElement;
        container.style.setProperty("display", "none", "important");
      }
      return;
    }

    const repoUrl = cloneData ? cloneData.url : null;
    if (!repoUrl) return;

    if (sourcetreeBtn) {
      const anchor =
        sourcetreeBtn.tagName === "A"
          ? sourcetreeBtn
          : sourcetreeBtn.querySelector("a");
      const newHref = `sourcetree://cloneRepo?type=github&cloneUrl=${encodeURIComponent(repoUrl)}`;
      if (anchor.href !== newHref) {
        anchor.href = newHref;
      }
      const container =
        sourcetreeBtn.closest("li") ||
        sourcetreeBtn.closest(".SelectMenu-item") ||
        sourcetreeBtn.closest('[role="menuitem"]') ||
        sourcetreeBtn.parentElement;
      container.style.setProperty("display", "", "important");
      return;
    }

    // Create new button
    const sourcetreeListItem = zipTarget.container.cloneNode(true);
    const sourcetreeAnchor =
      sourcetreeListItem.querySelector("a") ||
      (sourcetreeListItem.tagName === "A" ? sourcetreeListItem : null);

    if (!sourcetreeAnchor) return;

    sourcetreeAnchor.href = `sourcetree://cloneRepo?type=github&cloneUrl=${encodeURIComponent(repoUrl)}`;
    sourcetreeAnchor.id = sourcetreeButtonId;

    for (const attr of [...sourcetreeAnchor.attributes]) {
      if (attr.name.startsWith("data-") || attr.name === "rel")
        sourcetreeAnchor.removeAttribute(attr.name);
    }
    sourcetreeAnchor.setAttribute("rel", "nofollow");

    const svg = sourcetreeAnchor.querySelector("svg");
    if (svg) svg.outerHTML = sourcetreeIconSvg;
    else sourcetreeAnchor.insertAdjacentHTML("afterbegin", sourcetreeIconSvg);

    const walker = document.createTreeWalker(
      sourcetreeAnchor,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    let node;
    let textFound = false;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim().length > 0) {
        node.textContent = "Open with Sourcetree";
        textFound = true;
        break;
      }
    }
    if (!textFound) sourcetreeAnchor.innerText = "Open with Sourcetree";

    zipTarget.container.parentNode.insertBefore(
      sourcetreeListItem,
      zipTarget.container,
    );
    log("Sourcetree button added. Tab:", activeTabText);
  }

  setInterval(addSourcetreeButton, 300);

  document.addEventListener(
    "click",
    () => {
      setTimeout(addSourcetreeButton, 50);
      setTimeout(addSourcetreeButton, 200);
    },
    true,
  );

  const observer = new MutationObserver(() => addSourcetreeButton());
  observer.observe(document.body, { childList: true, subtree: true });
})();
